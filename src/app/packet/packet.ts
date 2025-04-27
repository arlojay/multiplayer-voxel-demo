import { BinaryBuffer, U16, U32 } from "../binary";
import { makeAdvancingTimestamp } from "../timestamp";

export abstract class Packet {
    private static packetTypes: Map<number, () => Packet> = new Map;
    private static nextId: number = 0;

    public static register(factory: () => Packet): number {
        this.packetTypes.set(this.nextId, factory);
        return this.nextId++;
    }
    public static createFromBinary(buffer: ArrayBuffer) {
        const bin = new BinaryBuffer(buffer);

        const id = bin.read_u16();
        const timestamp = bin.read_u32();

        const factory = this.packetTypes.get(id);
        if(factory == null) throw new TypeError(
            "Invalid packet " + id + (
                buffer.byteLength < 128
                    ? " (" + new Uint8Array(buffer).toString() + ")"
                    : ""
            )
        );

        const packet = factory();
        packet.timestamp = timestamp;
        packet.read(bin);

        return packet;
    }


    public abstract readonly id: number;
    public timestamp: number = 0;
    protected abstract serialize(bin: BinaryBuffer): void;
    protected abstract deserialize(bin: BinaryBuffer): void;

    public read(bin: BinaryBuffer) {
        this.deserialize(bin);
    }
    
    public write(bin: BinaryBuffer) {
        bin.write_u16(this.id);
        bin.write_u32(this.timestamp = makeAdvancingTimestamp());
        this.serialize(bin);
    }

    public getBufferSize() {
        return this.getExpectedSize() + U16 + U32;
    }

    protected abstract getExpectedSize(): number;
}