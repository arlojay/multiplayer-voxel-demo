import { BinaryBuffer, I32 } from "../binary";
import { Packet } from "./packet";

export class GetChunkPacket extends Packet {
    static id = Packet.register(() => new this);
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

    protected getExpectedSize() {
        return I32 * 3;
    }
}