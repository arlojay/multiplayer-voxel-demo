import { CHUNK_SIZE } from "../voxelGrid";
import { BinaryWriter, F32, I32, U16, U32 } from "../binary";
import { ServerPlayer } from "../server/serverPlayer";
import { makeAdvancingTimestamp } from "../timestamp";

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
        const timestamp = writer.read_u32();

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
        packet.read(writer);

        return packet;
    }


    public abstract readonly id: number;
    public timestamp: number = 0;
    protected abstract serialize(writer: BinaryWriter): void;
    protected abstract deserialize(writer: BinaryWriter): void;

    public read(writer: BinaryWriter) {
        this.deserialize(writer);
    }
    
    public write(writer: BinaryWriter) {
        writer.write_u16(this.id);
        writer.write_u32(this.timestamp = makeAdvancingTimestamp());
        this.serialize(writer);
    }

    public getBufferSize() {
        return this.getExpectedSize() + U16 + U32;
    }

    protected abstract getExpectedSize(): number;
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

    protected getExpectedSize() {
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

    protected getExpectedSize() {
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

    protected getExpectedSize(): number {
        return I32 * 3 + U16;
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

    protected getExpectedSize(): number {
        let size = U16;

        for(const packet of this.packets) {
            size += BinaryWriter.bufferByteCount(packet);
        }

        return size;
    }
}

abstract class PlayerInfo extends Packet {
    public x: number;
    public y: number;
    public z: number;
    public vx: number;
    public vy: number;
    public vz: number;
    public yaw: number;
    public pitch: number;

    public constructor(player?: ServerPlayer) {
        super();

        if(player == null) return;

        [ this.x, this.y, this.z ] = player.position.toArray();
        [ this.vx, this.vy, this.vz ] = player.velocity.toArray();
        [ this.yaw, this.pitch ] = [ player.yaw, player.pitch ];
    }

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

    protected getExpectedSize(): number {
        return (F32 * 3) + (F32 * 3) + (F32 * 2);
    }
}

export class ClientMovePacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = ClientMovePacket.id

    protected serialize(writer: BinaryWriter): void {
        super.serialize(writer);
    }

    protected deserialize(writer: BinaryWriter): void {
        super.deserialize(writer);
    }

    protected getExpectedSize(): number {
        return super.getExpectedSize();
    }
}

export class PlayerMovePacket extends PlayerInfo {
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

    protected getExpectedSize(): number {
        return super.getExpectedSize() + BinaryWriter.stringByteCount(this.player);
    }
}

export class PlayerJoinPacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = PlayerJoinPacket.id;

    public player: string;

    protected serialize(writer: BinaryWriter): void {
        super.serialize(writer);
        writer.write_string(this.player);
    }

    protected deserialize(writer: BinaryWriter): void {
        super.deserialize(writer);
        this.player = writer.read_string();
    }

    protected getExpectedSize(): number {
        return super.getExpectedSize() + BinaryWriter.stringByteCount(this.player);
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

    protected getExpectedSize(): number {
        return BinaryWriter.stringByteCount(this.player);
    }
}

export class PlaceBlockPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PlaceBlockPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public block: number;

    protected serialize(writer: BinaryWriter): void {
        writer.write_i32(this.x);
        writer.write_i32(this.y);
        writer.write_i32(this.z);
        writer.write_u16(this.block);
    }

    protected deserialize(writer: BinaryWriter): void {
        this.x = writer.read_i32();
        this.y = writer.read_i32();
        this.z = writer.read_i32();
        this.block = writer.read_u16();
    }

    protected getExpectedSize(): number {
        return (I32 * 3) + U16;
    }
}

export class BreakBlockPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = BreakBlockPacket.id;

    public x: number;
    public y: number;
    public z: number;

    protected serialize(writer: BinaryWriter): void {
        writer.write_i32(this.x);
        writer.write_i32(this.y);
        writer.write_i32(this.z);
    }

    protected deserialize(writer: BinaryWriter): void {
        this.x = writer.read_i32();
        this.y = writer.read_i32();
        this.z = writer.read_i32();
    }

    protected getExpectedSize(): number {
        return I32 * 3;
    }
}

export class PingPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PingPacket.id;

    protected serialize(writer: BinaryWriter): void {
        
    }
    protected deserialize(writer: BinaryWriter): void {
        
    }
    protected getExpectedSize(): number {
        return 0;
    }
}

export class PingResponsePacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PingResponsePacket.id;

    protected serialize(writer: BinaryWriter): void {
        
    }
    protected deserialize(writer: BinaryWriter): void {
        
    }
    protected getExpectedSize(): number {
        return 0;
    }
}

export class KickPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = KickPacket.id;

    public reason: string;

    protected serialize(writer: BinaryWriter): void {
        writer.write_string(this.reason);
    }
    protected deserialize(writer: BinaryWriter): void {
        this.reason = writer.read_string();
    }
    protected getExpectedSize(): number {
        return BinaryWriter.stringByteCount(this.reason);
    }
}

export class SetLocalPlayerPositionPacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = SetLocalPlayerPositionPacket.id;
}