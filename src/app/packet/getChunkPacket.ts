import { BinaryBuffer, I32 } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class GetChunkPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = GetChunkPacket.id;
    
    public x: number;
    public y: number;
    public z: number;

    protected deserialize(bin: BinaryBuffer) {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
    }

    protected serialize(bin: BinaryBuffer) {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
    }

    protected getOwnExpectedSize() {
        return I32 * 3;
    }
}