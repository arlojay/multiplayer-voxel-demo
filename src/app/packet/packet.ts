import { BinaryBuffer, U16, U32 } from "../binary";
import { BufferSerializable, BufferSerializableRegistry } from "../bufferSerializable";
import { makeAdvancingTimestamp } from "../timestamp";

export const packetRegistry = new class PacketRegistry extends BufferSerializableRegistry<Packet, ConstructorParameters<typeof Packet>> {
    
}

export abstract class Packet extends BufferSerializable {
    public static register(factory: new () => Packet): number {
        return packetRegistry.register(factory);
    }
    public static createFromBinary(buffer: ArrayBuffer) {
        return packetRegistry.createFromBinary(buffer);
    }
    
    public timestamp: number = 0;
    protected abstract serialize(bin: BinaryBuffer): void;
    protected abstract deserialize(bin: BinaryBuffer): void;

    public read(bin: BinaryBuffer) {
        this.timestamp = bin.read_u32();
        super.read(bin);
    }
    
    public write(bin: BinaryBuffer) {
        bin.write_u32(this.timestamp = makeAdvancingTimestamp());
        super.write(bin);
    }

    public getBufferSize() {
        return super.getBufferSize() + U32;
    }

    protected abstract getExpectedSize(): number;
}