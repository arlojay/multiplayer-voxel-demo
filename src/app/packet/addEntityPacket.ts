import { BinaryBuffer, U32 } from "../binary";
import { Packet } from "./packet";

export class AddEntityPacket extends Packet {
    public static readonly id = Packet.register(() => new this);
    public readonly id = AddEntityPacket.id;

    public uuid: string;
    public type: number;
    public entityData: ArrayBuffer;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_u32(this.type);
        bin.write_buffer(this.entityData);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.type = bin.read_u32();
        this.entityData = bin.read_buffer();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            U32 +
            BinaryBuffer.bufferByteCount(this.entityData)
        )
    }
}