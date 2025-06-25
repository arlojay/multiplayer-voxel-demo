import { BinaryBuffer, U32 } from "../serialization/binaryBuffer";
import { BufferSerializable, BufferSerializableRegistry } from "../serialization/bufferSerializable";
import { makeAdvancingTimestamp } from "../timestamp";

export const packetRegistry = new class PacketRegistry extends BufferSerializableRegistry<Packet, ConstructorParameters<typeof Packet>> {
    
}

export abstract class Packet extends BufferSerializable {    
    public timestamp: number = 0;
    protected abstract serialize(bin: BinaryBuffer): void;
    protected abstract deserialize(bin: BinaryBuffer): void;

    public read(bin: BinaryBuffer) {
        super.read(bin);
        this.timestamp = bin.read_u32();
    }
    
    public write(bin: BinaryBuffer) {
        super.write(bin);
        bin.write_u32(this.timestamp = makeAdvancingTimestamp());
    }

    public getBufferSize() {
        return super.getBufferSize() + U32;
    }
}