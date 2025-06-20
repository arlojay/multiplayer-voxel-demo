import { BinaryBuffer } from "../binary";
import { Packet, packetRegistry } from "./packet";

export class LibraryDataResponsePacket extends Packet {
    public static id = packetRegistry.register(this);
    public id = LibraryDataResponsePacket.id;
    
    public type: string;
    public buffer: ArrayBuffer;

    public constructor(type?: string, buffer?: ArrayBuffer) {
        super();
        if(type != null) this.type = type;
        if(buffer != null) this.buffer = buffer;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.type);
        bin.write_buffer(this.buffer);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.type = bin.read_string();
        this.buffer = bin.read_buffer();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.type) +
            BinaryBuffer.bufferByteCount(this.buffer)
        );
    }
}