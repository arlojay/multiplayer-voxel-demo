import { read_i32, read_u16, read_u32, Sink, write_i32, write_u16, write_u32 } from "ts-binary";

export const PACKET_INITIAL_SIZE = 20;

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
        packet.read(sink);

        return packet;
    }


    public abstract id: number;
    protected abstract serialize(sink: Sink): void;
    protected abstract deserialize(sink: Sink): void;

    public read(sink: Sink) {
        this.deserialize(sink);
    }
    
    public write(sink: Sink) {
        write_u16(sink, this.id);
        this.serialize(sink);
    }

    public getExpectedSize() {
        return PACKET_INITIAL_SIZE;
    }
}

export class GetChunkPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = GetChunkPacket.id;
    
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

    public getExpectedSize() {
        return 12;
    }
}

export class SetBlockPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = SetBlockPacket.id;
    
    public x: number;
    public y: number;
    public z: number;
    public block: number;

    protected deserialize(sink: Sink) {
        this.x = read_i32(sink);
        this.y = read_i32(sink);
        this.z = read_i32(sink);
        this.block = read_i32(sink);
    }

    protected serialize(sink: Sink) {
        write_i32(sink, this.x);
        write_i32(sink, this.y);
        write_i32(sink, this.z);
        write_i32(sink, this.block);
    }

    public getExpectedSize(): number {
        return 16;
    }
}