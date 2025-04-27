import { BinaryBuffer, I32, U16 } from "../binary";
import { Packet } from "./packet";

export class PlaceBlockPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PlaceBlockPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public block: number;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
        bin.write_u16(this.block);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
        this.block = bin.read_u16();
    }

    protected getExpectedSize(): number {
        return (I32 * 3) + U16;
    }
}