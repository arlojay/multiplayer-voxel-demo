import { BinaryBuffer } from "../binary";
import { Packet } from "./packet";

export class RemoveEntityPacket extends Packet {
    public static readonly id = Packet.register(() => new this);
    public readonly id = RemoveEntityPacket.id;

    public uuid: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid)
        )
    }
}