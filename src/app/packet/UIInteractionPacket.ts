import { BinaryBuffer, I32 } from "../binary";
import { Packet } from "./packet";

export class UIInteractionPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = UIInteractionPacket.id;

    public path: number[];
    public interfaceId: string;
    public interaction: number;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.interfaceId);
        bin.write_buffer(new Uint32Array(this.path).buffer);
        bin.write_i32(this.interaction);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.interfaceId = bin.read_string();
        this.path = Array.from(new Uint32Array(bin.read_buffer()));
        this.interaction = bin.read_i32();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.interfaceId) +
            BinaryBuffer.bufferByteCount(new Uint32Array(this.path).buffer) +
            I32
        );
    }
}