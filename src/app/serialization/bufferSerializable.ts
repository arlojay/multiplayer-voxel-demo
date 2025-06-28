import { IndexedFactoryRegistry } from "../synchronization/registry";
import { BinaryBuffer, U16 } from "./binaryBuffer";
import { Serializable } from "./serializable";

export abstract class BufferSerializableRegistry<
    SerializableType extends BufferSerializable,
    FactoryParams extends ConstructorParameters<any>,
    FactoryType = new (...params: FactoryParams) => SerializableType
> extends IndexedFactoryRegistry<SerializableType, FactoryParams, FactoryType> {
    public createFromBinary(buffer: ArrayBuffer | BinaryBuffer, ...args: FactoryParams) {
        const bin = buffer instanceof BinaryBuffer ? buffer : new BinaryBuffer(buffer);

        const id = bin.read_u16();

        const Constructor = this.types.get(id);
        if(Constructor == null) throw new TypeError(
            "Invalid registered object " + id + (
                bin.buffer.byteLength < 128
                    ? " (" + new Uint8Array(bin.buffer).toString() + ")"
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

export abstract class BufferSerializable extends Serializable {
    public abstract readonly id: number;
    
    public read(bin: BinaryBuffer) {
        this.deserialize(bin);
    }
    
    public write(bin: BinaryBuffer) {
        bin.write_u16(this.id);
        this.serialize(bin);
    }

    public getExpectedSize() {
        return U16 + this.getOwnExpectedSize();
    }

    protected abstract getOwnExpectedSize(): number;
}