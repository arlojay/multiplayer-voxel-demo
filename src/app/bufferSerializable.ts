import { BinaryBuffer, U16 } from "./binary";

export abstract class BufferSerializableRegistry<T extends BufferSerializable> {
    private types: Map<number, () => T> = new Map;
    private nextId: number = 0;

    public register(factory: () => T): number {
        this.types.set(this.nextId, factory);
        return this.nextId++;
    }
    public createFromBinary(buffer: ArrayBuffer) {
        const bin = new BinaryBuffer(buffer);

        const id = bin.read_u16();

        const factory = this.types.get(id);
        if(factory == null) throw new TypeError(
            "Invalid registered object " + id + (
                buffer.byteLength < 128
                    ? " (" + new Uint8Array(buffer).toString() + ")"
                    : ""
            )
        );

        const instance = factory();
        instance.read(bin);

        return instance;
    }
}

export abstract class BufferSerializable {
    public abstract readonly id: number;
    protected abstract serialize(bin: BinaryBuffer): void;
    protected abstract deserialize(bin: BinaryBuffer): void;

    public read(bin: BinaryBuffer) {
        this.deserialize(bin);
    }
    
    public write(bin: BinaryBuffer) {
        bin.write_u16(this.id);
        this.serialize(bin);
    }

    public getBufferSize() {
        return this.getExpectedSize() + U16;
    }

    protected abstract getExpectedSize(): number;
}