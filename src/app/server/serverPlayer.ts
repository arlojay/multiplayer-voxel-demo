import { RemoteEntity } from "../entity/remoteEntity";
import { SetLocalPlayerPositionPacket } from "../packet/packet";
import { SOLID_BITMASK } from "../voxelGrid";
import { ServerPeer } from "./severPeer";

export class ServerPlayer extends RemoteEntity {
    public peer: ServerPeer;
    public yaw: number = 0;
    public pitch: number = 0;

    constructor(peer: ServerPeer) {
        super();
        this.peer = peer;
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

        for(y = 100; y > -20; y--) {
            if(~this.world.getRawValue(x, y - 1, z) & SOLID_BITMASK) continue;
            if(
                (~this.world.getRawValue(x, y, z) & SOLID_BITMASK) &&
                (~this.world.getRawValue(x, y + 1, z) & SOLID_BITMASK)
            ) break;
        }

        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
        this.syncPosition();
    }
    public syncPosition() {
        const packet = new SetLocalPlayerPositionPacket(this);
        this.peer.sendPacket(packet, true);
    }
}