import { Box3, Vector3 } from "three";
import { CollisionChecker } from "../entity/collisionChecker";
import { RemoteEntity } from "../entity/remoteEntity";
import { SetLocalPlayerPositionPacket } from "../packet/packet";
import { SOLID_BITMASK } from "../voxelGrid";
import { World } from "../world";
import { ServerPeer } from "./serverPeer";

export class ServerPlayer extends RemoteEntity {
    public peer: ServerPeer;
    public yaw: number = 0;
    public pitch: number = 0;
    public hitbox: Box3 = new Box3(
        new Vector3(-0.3, 0, -0.3),
        new Vector3(0.3, 1.8, 0.3)
    );
    public collisionChecker: CollisionChecker;

    constructor(peer: ServerPeer) {
        super();
        this.peer = peer;
    }

    public setWorld(world: World): void {
        super.setWorld(world);
        this.collisionChecker = new CollisionChecker(this.hitbox, this.position, world);
        console.log(world);
    }

    public update(dt: number): void {
        if(this.position.y < -100) {
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
                if(~this.world.getRawValue(x, y - 1, z) & SOLID_BITMASK) continue;
                if(
                    (~this.world.getRawValue(x, y, z) & SOLID_BITMASK) &&
                    (~this.world.getRawValue(x, y + 1, z) & SOLID_BITMASK)
                ) break;
            }

            attempts++;

            if(attempts >= 64) {
                x = 0;
                y = 10;
                z = 0;
            }
        } while(y <= minY);

        this.position.set(x + 0.5, y, z + 0.5);
        this.velocity.set(0, 0, 0);
        this.pitch = 0;
        this.yaw = 0;

        this.syncPosition();
    }
    public syncPosition() {
        const packet = new SetLocalPlayerPositionPacket(this);
        this.peer.sendPacket(packet, true);
    }
}