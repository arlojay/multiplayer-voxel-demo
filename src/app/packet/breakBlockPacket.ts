import { BinaryBuffer, I32 } from "../binary";
import { Packet } from "./packet";

export class BreakBlockPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = BreakBlockPacket.id;

    public x: number;
    public y: number;
    public z: number;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
    }

    protected getExpectedSize(): number {
        return I32 * 3;
    }
}