import { BinaryBuffer, U16 } from "./binary";

export abstract class BufferSerializableRegistry<
    SerializableType extends BufferSerializable,
    FactoryParams extends ConstructorParameters<any>,
    FactoryType = new (...params: FactoryParams) => SerializableType
> {
    private types: Map<number, FactoryType> = new Map;
    private nextId: number = 0;

    public register(factory: FactoryType): number {
        this.types.set(this.nextId, factory);
        return this.nextId++;
    }
    public createFromBinary(buffer: ArrayBuffer, ...args: FactoryParams) {
        const bin = new BinaryBuffer(buffer);

        const id = bin.read_u16();

        const Constructor = this.types.get(id);
        if(Constructor == null) throw new TypeError(
            "Invalid registered object " + id + (
                buffer.byteLength < 128
                    ? " (" + new Uint8Array(buffer).toString() + ")"
                    : ""
            )
        );

        const instance: SerializableType = Reflect.construct(Constructor as (...params: unknown[]) => unknown, args);
        
        try {
            instance.read(bin);
        } catch(e) {
            throw new Error("Failed to create object from binary " + (instance.constructor?.name), { cause: e });
        }
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

    public allocateBuffer() {
        return new ArrayBuffer(this.getBufferSize());
    }

    protected getBufferSize() {
        return this.getExpectedSize() + U16;
    }

    protected abstract getExpectedSize(): number;
}