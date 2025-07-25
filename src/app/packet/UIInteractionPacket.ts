import { BinaryBuffer, I32 } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class UIInteractionPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = UIInteractionPacket.id;

    public path: number[];
    public interfaceId: string;
    public interaction: number;
    public data: any;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.interfaceId);
        bin.write_buffer(new Uint32Array(this.path).buffer);
        bin.write_i32(this.interaction);
        bin.write_json(this.data);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.interfaceId = bin.read_string();
        this.path = Array.from(new Uint32Array(bin.read_buffer()));
        this.interaction = bin.read_i32();
        this.data = bin.read_json();
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.interfaceId) +
            BinaryBuffer.bufferByteCount(new Uint32Array(this.path).buffer) +
            I32 +
            BinaryBuffer.jsonByteCount(this.data)
        );
    }
}