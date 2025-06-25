import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class KickPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = KickPacket.id;

    public reason: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.reason);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.reason = bin.read_string();
    }
    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.reason);
    }
}