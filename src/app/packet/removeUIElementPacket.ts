import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class RemoveUIElementPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = RemoveUIElementPacket.id;

    public path: number[];
    public interfaceId: string;

    public constructor(interfaceId?: string, path?: number[]) {
        super();
        if(interfaceId != null) this.interfaceId = interfaceId;
        if(path != null) this.path = path;
    }
    
    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.interfaceId);
        bin.write_buffer(new Uint32Array(this.path).buffer);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.interfaceId = bin.read_string();
        this.path = Array.from(new Uint32Array(bin.read_buffer()));
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.interfaceId) +
            BinaryBuffer.bufferByteCount(new Uint32Array(this.path).buffer)
        );
    }
}