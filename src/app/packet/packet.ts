import { read_i32, read_u16, Sink, write_i32, write_u16 } from "ts-binary";

export abstract class Packet {
    private static packetTypes: Map<number, () => Packet> = new Map;
    private static nextId: number = 0;

    public static register(factory: () => Packet): number {
        this.packetTypes.set(this.nextId, factory);
        return this.nextId++;
    }
    public static createFromBinary(buffer: ArrayBuffer) {
        const sink = Sink(buffer);

        const id = read_u16(sink);
        const factory = this.packetTypes.get(id);

        const packet = factory();
        packet.fromBinary(sink);

        return packet;
    }


    public abstract id: number;
    protected abstract serialize(sink: Sink): void;
    protected abstract deserialize(sink: Sink): void;

    public fromBinary(sink: Sink) {
        this.deserialize(sink);
    }
    
    public toBinary(sink: Sink) {
        write_u16(sink, this.id);
        this.serialize(sink);
    }
}

export class GetChunkPacket extends Packet {
    static id: number = Packet.register(() => new this);
    public id: number = GetChunkPacket.id;
    
    public x: number;
    public y: number;
    public z: number;

    protected deserialize(sink: Sink) {
        this.x = read_i32(sink);
        this.y = read_i32(sink);
        this.z = read_i32(sink);
    }

    protected serialize(sink: Sink) {
        write_i32(sink, this.x);
        write_i32(sink, this.y);
        write_i32(sink, this.z);
    }
}