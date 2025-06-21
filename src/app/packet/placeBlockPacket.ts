import { BinaryBuffer, I32 } from "../binary";
import { BlockStateSaveKey } from "../block/blockState";
import { Packet, packetRegistry } from "./packet";

export class PlaceBlockPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = PlaceBlockPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public block: BlockStateSaveKey;
    
    protected deserialize(bin: BinaryBuffer) {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();

        this.block = bin.read_string() as BlockStateSaveKey;
    }

    protected serialize(bin: BinaryBuffer) {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);

        bin.write_string(this.block);
    }

    protected getExpectedSize(): number {
        return I32 * 3 + BinaryBuffer.stringByteCount(this.block)
    }
}