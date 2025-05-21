import { Box3, Vector3 } from "three";
import { CollisionChecker } from "../entity/collisionChecker";
import { Player } from "../entity/impl/playerEntity";
import { ClientMovePacket, SetLocalPlayerPositionPacket } from "../packet";
import { CHUNK_INC_SCL, SOLID_BITMASK } from "../voxelGrid";
import { World } from "../world";
import { ServerPeer } from "./serverPeer";
import { EntityLogicType } from "../entity/baseEntity";
import { PeerMoveEvent } from "./pluginEvents";

export class ServerPlayer {
    public peer: ServerPeer;
    public player: Player;
    private collisionChecker: CollisionChecker;

    constructor(peer: ServerPeer) {
        this.peer = peer;
        this.player = new Player(EntityLogicType.NO_LOGIC);
    }

    public setWorld(world: World): void {
        this.player.setWorld(world);
        this.collisionChecker = new CollisionChecker(this.player.hitbox, this.player.position, world);
    }

    public update(dt: number): void {
        if(this.player.position.y < -100) {
            this.respawn();
        }
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
                if(~this.player.world.getRawValue(x, y - 1, z) & SOLID_BITMASK) continue;
                if(
                    (~this.player.world.getRawValue(x, y, z) & SOLID_BITMASK) &&
                    (~this.player.world.getRawValue(x, y + 1, z) & SOLID_BITMASK)
                ) break;
            }

            attempts++;

            if(attempts >= 64) {
                x = 0;
                y = 10;
                z = 0;
            }
        } while(y <= minY);

        this.player.position.set(x + 0.5, y, z + 0.5);
        this.player.velocity.set(0, 0, 0);
        this.player.pitch = 0;
        this.player.yaw = 0;

        this.syncPosition();
    }
    public syncPosition() {
        const packet = new SetLocalPlayerPositionPacket(this.player);
        this.peer.sendPacket(packet, true);
    }
    public get world() {
        return this.player.world;
    }
    public handleMovement(packet: ClientMovePacket) {
        if(!this.player.world.blocks.chunkExists(packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL)) {
            this.syncPosition();
            return false;
        }

        const wasColliding = this.collisionChecker.isCollidingWithWorld(-0.01);
        const oldPosition = this.player.position.clone();
        this.player.position.set(packet.x, packet.y, packet.z);
        const isColliding = this.collisionChecker.isCollidingWithWorld(-0.01);

        if(isColliding) {
            if(wasColliding) {
                this.respawn();
            } else {
                this.player.velocity.set(0, 0, 0);
                this.player.position.copy(oldPosition);
                this.syncPosition();
            }
        } else {
            this.player.velocity.set(packet.vx, packet.vy, packet.vz);
            this.player.yaw = packet.yaw;
            this.player.pitch = packet.pitch;
        }

        
        const event = new PeerMoveEvent(this.peer.server);
        event.peer = this.peer;
        event.player = this;
        event.world = this.player.world;
        event.x = packet.x;
        event.y = packet.y;
        event.z = packet.z;
        event.vx = packet.vx;
        event.vy = packet.vy;
        event.vz = packet.vz;
        event.yaw = packet.yaw;
        event.pitch = packet.pitch;
        this.peer.server.emit(event);

        if(event.isCancelled()) {
            this.player.velocity.set(0, 0, 0);
            this.player.position.copy(oldPosition);
            this.syncPosition();

            return false;
        }
        return true;
    }
}