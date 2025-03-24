import { read_i32, read_u16, read_u32, read_u64, Sink, write_i32, write_u16, write_u32 } from "ts-binary";
import { CHUNK_SIZE } from "../voxelGrid";

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

    public abstract getExpectedSize(): number;
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

export class ChunkDataPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = ChunkDataPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public data: Uint16Array = new Uint16Array(CHUNK_SIZE ** 3);

    protected deserialize(sink: Sink) {
        this.x = read_i32(sink);
        this.y = read_i32(sink);
        this.z = read_i32(sink);

        for(let i = 0; i < this.data.length; i++) {
            this.data[i] = read_u16(sink);
        }
    }

    protected serialize(sink: Sink) {
        write_i32(sink, this.x);
        write_i32(sink, this.y);
        write_i32(sink, this.z);

        for(let i = 0; i < this.data.length; i++) {
            write_u16(sink, this.data[i]);
        }
    }

    public getExpectedSize() {
        return (3 * 4) + (CHUNK_SIZE ** 3) * 2;
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

export class CombinedPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = SetBlockPacket.id;
    
    public packets: Set<ArrayBuffer> = new Set;

    protected deserialize(sink: Sink) {
        this.packets.clear();

        const buffer = sink.view.buffer as ArrayBuffer;

        const packetCount = read_u16(sink);
        for(let i = 0; i < packetCount; i++) {
            const length = read_u32(sink);
            this.packets.add(buffer.slice(sink.pos, sink.pos + length));
            sink.pos += length;
        }
    }

    protected serialize(sink: Sink) {
        const buffer = sink.view.buffer as ArrayBuffer;
        const bufferArray = new Uint8Array(buffer);

        write_u16(sink, this.packets.size);

        for(const packet of this.packets) {
            write_u32(sink, packet.byteLength);
            bufferArray.set(new Uint8Array(packet), sink.pos);
            sink.pos += packet.byteLength;
        }
    }

    public getExpectedSize(): number {
        let size = 2;

        for(const packet of this.packets) {
            size += 4;
            size += packet.byteLength;
        }

        return size;
    }
}