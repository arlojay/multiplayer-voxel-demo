import { BinaryBuffer } from "./binaryBuffer";

export interface SerializableGeneric {
    write(bin: BinaryBuffer): void;
    read(bin: BinaryBuffer): void;
    getExpectedSize(): number;
}

export abstract class Serializable implements SerializableGeneric {
    protected abstract serialize(bin: BinaryBuffer): void;
    protected abstract deserialize(bin: BinaryBuffer): void;

    public read(bin: BinaryBuffer) {
        this.deserialize(bin);
    }
    
    public write(bin: BinaryBuffer) {
        this.serialize(bin);
    }

    public allocateBuffer() {
        return new ArrayBuffer(this.getExpectedSize());
    }

    public abstract getExpectedSize(): number;
}