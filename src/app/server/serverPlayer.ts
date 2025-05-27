import { CollisionChecker } from "../entity/collisionChecker";
import { Player } from "../entity/impl";
import { ClientMovePacket, SetLocalPlayerPositionPacket } from "../packet";
import { CHUNK_INC_SCL, SOLID_BITMASK } from "../voxelGrid";
import { World } from "../world";
import { ServerPeer } from "./serverPeer";
import { EntityLogicType } from "../entity/baseEntity";
import { PeerMoveEvent } from "./pluginEvents";

export class ServerPlayer {
    public peer: ServerPeer;
    public base: Player;
    private collisionChecker: CollisionChecker;

    constructor(peer: ServerPeer) {
        this.peer = peer;
        this.base = new Player(EntityLogicType.NO_LOGIC);
    }

    public setWorld(world: World): void {
        this.base.setWorld(world);
        this.collisionChecker = new CollisionChecker(this.base.hitbox, this.base.position, world);
    }

    public update(dt: number): void {
        if(this.base.position.y < -100) {
            this.respawn();
        }
    }

    public onAuthenticated() {
        this.base.username = this.peer.username;
        this.base.color = this.peer.color;
    }

    public respawn() {
        let x = 0;
        let y = 100;
        let z = 0;

        const minY = -20;
        let attempts = 0;

        do {
            x = Math.round(Math.random() * 32 - 16);
            z = Math.round(Math.random() * 32 - 16);

            for(y = 100; y > minY; y--) {
                if(~this.base.world.getRawValue(x, y - 1, z) & SOLID_BITMASK) continue;
                if(
                    (~this.base.world.getRawValue(x, y, z) & SOLID_BITMASK) &&
                    (~this.base.world.getRawValue(x, y + 1, z) & SOLID_BITMASK)
                ) break;
            }

            attempts++;

            if(attempts >= 64) {
                x = 0;
                y = 10;
                z = 0;
            }
        } while(y <= minY);

        this.base.position.set(x + 0.5, y, z + 0.5);
        this.base.velocity.set(0, 0, 0);
        this.base.rotation.pitch = 0;
        this.base.rotation.yaw = 0;

        this.syncPosition();
    }
    public syncPosition() {
        const packet = new SetLocalPlayerPositionPacket(this.base);
        this.peer.sendPacket(packet, true);
    }
    public get world() {
        return this.base.world;
    }
    public handleMovement(packet: ClientMovePacket) {
        if(!this.base.world.blocks.chunkExists(packet.position.x >> CHUNK_INC_SCL, packet.position.y >> CHUNK_INC_SCL, packet.position.z >> CHUNK_INC_SCL)) {
            this.syncPosition();
            return false;
        }

        const wasColliding = this.collisionChecker.isCollidingWithWorld(-0.01);
        const oldPosition = this.base.position.clone();
        this.base.position.set(packet.position.x, packet.position.y, packet.position.z);
        const isColliding = this.collisionChecker.isCollidingWithWorld(-0.01);

        if(isColliding) {
            if(wasColliding) {
                this.respawn();
            } else {
                this.base.velocity.set(0, 0, 0);
                this.base.position.copy(oldPosition);
                this.syncPosition();
            }
        } else {
            this.base.velocity.set(packet.velocity.x, packet.velocity.y, packet.velocity.z);
            this.base.rotation.yaw = packet.yaw;
            this.base.rotation.pitch = packet.pitch;
        }

        
        const event = new PeerMoveEvent(this.peer.server);
        event.peer = this.peer;
        event.serverPlayer = this;
        event.player = this.base;
        event.world = this.base.world;
        event.x = packet.position.x;
        event.y = packet.position.y;
        event.z = packet.position.z;
        event.vx = packet.velocity.x;
        event.vy = packet.velocity.y;
        event.vz = packet.velocity.z;
        event.pitch = packet.pitch;
        event.yaw = packet.yaw;
        this.peer.server.emit(event);

        if(event.isCancelled()) {
            this.base.velocity.set(0, 0, 0);
            this.base.position.copy(oldPosition);
            this.syncPosition();

            return false;
        }
        return true;
    }
}