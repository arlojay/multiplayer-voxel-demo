import { CHUNK_SIZE } from "../voxelGrid";
import { BinaryWriter, F32, I32, U16 } from "../binary";

export abstract class Packet {
    private static packetTypes: Map<number, () => Packet> = new Map;
    private static nextId: number = 0;

    public static register(factory: () => Packet): number {
        this.packetTypes.set(this.nextId, factory);
        return this.nextId++;
    }
    public static createFromBinary(buffer: ArrayBuffer) {
        const writer = new BinaryWriter(buffer);

        const id = writer.read_u16();
        const factory = this.packetTypes.get(id);
        if(factory == null) throw new TypeError(
            "Invalid packet " + id + (
                buffer.byteLength < 128
                    ? " (" + new Uint8Array(buffer).toString() + ")"
                    : ""
            )
        );

        const packet = factory();
        packet.read(writer);

        return packet;
    }


    public abstract id: number;
    protected abstract serialize(writer: BinaryWriter): void;
    protected abstract deserialize(writer: BinaryWriter): void;

    public read(writer: BinaryWriter) {
        this.deserialize(writer);
    }
    
    public write(writer: BinaryWriter) {
        writer.write_u16(this.id);
        this.serialize(writer);
    }

    public abstract getExpectedSize(): number;
}

export class GetChunkPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = GetChunkPacket.id;
    
    public x: number;
    public y: number;
    public z: number;

    protected deserialize(writer: BinaryWriter) {
        this.x = writer.read_i32();
        this.y = writer.read_i32();
        this.z = writer.read_i32();
    }

    protected serialize(writer: BinaryWriter) {
        writer.write_i32(this.x);
        writer.write_i32(this.y);
        writer.write_i32(this.z);
    }

    public getExpectedSize() {
        return I32 * 3;
    }
}

export class ChunkDataPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = ChunkDataPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public data: Uint16Array = new Uint16Array(CHUNK_SIZE ** 3);

    protected deserialize(writer: BinaryWriter) {
        this.x = writer.read_i32();
        this.y = writer.read_i32();
        this.z = writer.read_i32();

        for(let i = 0; i < this.data.length; i++) {
            this.data[i] = writer.read_u16();
        }
    }

    protected serialize(sink: BinaryWriter) {
        sink.write_i32(this.x);
        sink.write_i32(this.y);
        sink.write_i32(this.z);

        for(let i = 0; i < this.data.length; i++) {
            sink.write_u16(this.data[i]);
        }
    }

    public getExpectedSize() {
        return I32 * 3 + BinaryWriter.bufferByteCount(U16 * CHUNK_SIZE ** 3);
    }
}

export class SetBlockPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = SetBlockPacket.id;
    
    public x: number;
    public y: number;
    public z: number;
    public block: number;

    protected deserialize(writer: BinaryWriter) {
        this.x = writer.read_i32();
        this.y = writer.read_i32();
        this.z = writer.read_i32();
        this.block = writer.read_u16();
    }

    protected serialize(writer: BinaryWriter) {
        writer.write_i32(this.x);
        writer.write_i32(this.y);
        writer.write_i32(this.z);
        writer.write_u16(this.block);
    }

    public getExpectedSize(): number {
        return I32 * 4;
    }
}

export class CombinedPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = CombinedPacket.id;
    
    public packets: Set<ArrayBuffer> = new Set;

    protected deserialize(writer: BinaryWriter) {
        this.packets.clear();

        const packetCount = writer.read_u16();
        for(let i = 0; i < packetCount; i++) {
            this.packets.add(writer.read_buffer());
        }
    }

    protected serialize(writer: BinaryWriter) {
        writer.write_u16(this.packets.size);

        for(const packet of this.packets) {
            writer.write_buffer(packet);
        }
    }

    public getExpectedSize(): number {
        let size = U16;

        for(const packet of this.packets) {
            size += BinaryWriter.bufferByteCount(packet);
        }

        return size;
    }
}

export class ClientMovePacket extends Packet {
    static id = Packet.register(() => new this);
    public id = ClientMovePacket.id;

    public x: number;
    public y: number;
    public z: number;
    public vx: number;
    public vy: number;
    public vz: number;
    public yaw: number;
    public pitch: number;

    protected serialize(writer: BinaryWriter): void {
        writer.write_f32(this.x);
        writer.write_f32(this.y);
        writer.write_f32(this.z);
        writer.write_f32(this.vx);
        writer.write_f32(this.vy);
        writer.write_f32(this.vz);
        writer.write_f32(this.yaw);
        writer.write_f32(this.pitch);
    }

    protected deserialize(writer: BinaryWriter): void {
        this.x = writer.read_f32();
        this.y = writer.read_f32();
        this.z = writer.read_f32();
        this.vx = writer.read_f32();
        this.vy = writer.read_f32();
        this.vz = writer.read_f32();
        this.yaw = writer.read_f32();
        this.pitch = writer.read_f32();
    }

    public getExpectedSize(): number {
        return (F32 * 3) + (F32 * 3) + (F32 * 2);
    }
}

export class PlayerMovePacket extends ClientMovePacket {
    static id = Packet.register(() => new this);
    public id = PlayerMovePacket.id;

    public player: string;

    protected serialize(writer: BinaryWriter): void {
        super.serialize(writer);
        writer.write_string(this.player);
    }

    protected deserialize(writer: BinaryWriter): void {
        super.deserialize(writer);
        this.player = writer.read_string();
    }

    public getExpectedSize(): number {
        return BinaryWriter.stringByteCount(this.player) + super.getExpectedSize();
    }
}

export class PlayerJoinPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PlayerJoinPacket.id;

    public player: string;

    protected serialize(writer: BinaryWriter): void {
        writer.write_string(this.player);
    }

    protected deserialize(writer: BinaryWriter): void {
        this.player = writer.read_string();
    }

    public getExpectedSize(): number {
        return BinaryWriter.stringByteCount(this.player);
    }
}

export class PlayerLeavePacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PlayerLeavePacket.id;

    public player: string;

    protected serialize(writer: BinaryWriter): void {
        writer.write_string(this.player);
    }

    protected deserialize(writer: BinaryWriter): void {
        this.player = writer.read_string();
    }

    public getExpectedSize(): number {
        return BinaryWriter.stringByteCount(this.player);
    }
}