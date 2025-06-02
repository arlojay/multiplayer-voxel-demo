import { BinaryBuffer, I32, U16 } from "../binary";
import { Packet, packetRegistry } from "./packet";

export class SetBlockPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = SetBlockPacket.id;
    
    public x: number;
    public y: number;
    public z: number;
    public block: number;

    protected deserialize(bin: BinaryBuffer) {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
        this.block = bin.read_u16();
    }

    protected serialize(bin: BinaryBuffer) {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
        bin.write_u16(this.block);
    }

    protected getExpectedSize(): number {
        return I32 * 3 + U16;
    }
}