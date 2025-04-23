import { CHUNK_SIZE } from "../voxelGrid";
import { BinaryBuffer, F32, I32, U16, U32 } from "../binary";
import { ServerPlayer } from "../server/serverPlayer";
import { makeAdvancingTimestamp } from "../timestamp";
import { UIElement } from "../ui/UIElement";
import { UIContainer } from "../ui/UIContainer";

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

export class GetChunkPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = GetChunkPacket.id;
    
    public x: number;
    public y: number;
    public z: number;

    protected deserialize(bin: BinaryBuffer) {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
    }

    protected serialize(bin: BinaryBuffer) {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
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

    public constructor(request?: GetChunkPacket) {
        super();

        if(request != null) {
            this.x = request.x;
            this.y = request.y;
            this.z = request.z;
        }
    }

    protected deserialize(bin: BinaryBuffer) {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();

        for(let i = 0; i < this.data.length; i++) {
            this.data[i] = bin.read_u16();
        }
    }

    protected serialize(sink: BinaryBuffer) {
        sink.write_i32(this.x);
        sink.write_i32(this.y);
        sink.write_i32(this.z);

        for(let i = 0; i < this.data.length; i++) {
            sink.write_u16(this.data[i]);
        }
    }

    protected getExpectedSize() {
        return I32 * 3 + BinaryBuffer.bufferByteCount(U16 * CHUNK_SIZE ** 3);
    }
}

export class SetBlockPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = SetBlockPacket.id;
    
    public x: number;
    public y: number;
    public z: number;
    public block: number;

    protected deserialize(bin: BinaryBuffer) {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
        this.block = bin.read_u16();
    }

    protected serialize(bin: BinaryBuffer) {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
        bin.write_u16(this.block);
    }

    protected getExpectedSize(): number {
        return I32 * 3 + U16;
    }
}

export class CombinedPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = CombinedPacket.id;
    
    public packets: Set<ArrayBuffer> = new Set;

    protected deserialize(bin: BinaryBuffer) {
        this.packets.clear();

        const packetCount = bin.read_u16();
        for(let i = 0; i < packetCount; i++) {
            this.packets.add(bin.read_buffer());
        }
    }

    protected serialize(bin: BinaryBuffer) {
        bin.write_u16(this.packets.size);

        for(const packet of this.packets) {
            bin.write_buffer(packet);
        }
    }

    protected getExpectedSize(): number {
        let size = U16;

        for(const packet of this.packets) {
            size += BinaryBuffer.bufferByteCount(packet);
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

    protected serialize(bin: BinaryBuffer): void {
        bin.write_f32(this.x);
        bin.write_f32(this.y);
        bin.write_f32(this.z);
        bin.write_f32(this.vx);
        bin.write_f32(this.vy);
        bin.write_f32(this.vz);
        bin.write_f32(this.yaw);
        bin.write_f32(this.pitch);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.x = bin.read_f32();
        this.y = bin.read_f32();
        this.z = bin.read_f32();
        this.vx = bin.read_f32();
        this.vy = bin.read_f32();
        this.vz = bin.read_f32();
        this.yaw = bin.read_f32();
        this.pitch = bin.read_f32();
    }

    protected getExpectedSize(): number {
        return (F32 * 3) + (F32 * 3) + (F32 * 2);
    }
}

export class ClientMovePacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = ClientMovePacket.id

    protected serialize(bin: BinaryBuffer): void {
        super.serialize(bin);
    }

    protected deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
    }

    protected getExpectedSize(): number {
        return super.getExpectedSize();
    }
}

export class PlayerMovePacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = PlayerMovePacket.id;

    public player: string;

    protected serialize(bin: BinaryBuffer): void {
        super.serialize(bin);
        bin.write_string(this.player);
    }

    protected deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.player = bin.read_string();
    }

    protected getExpectedSize(): number {
        return super.getExpectedSize() + BinaryBuffer.stringByteCount(this.player);
    }
}

export class PlayerJoinPacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = PlayerJoinPacket.id;

    public player: string;

    protected serialize(bin: BinaryBuffer): void {
        super.serialize(bin);
        bin.write_string(this.player);
    }

    protected deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.player = bin.read_string();
    }

    protected getExpectedSize(): number {
        return super.getExpectedSize() + BinaryBuffer.stringByteCount(this.player);
    }
}

export class PlayerLeavePacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PlayerLeavePacket.id;

    public player: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.player);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.player = bin.read_string();
    }

    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.player);
    }
}

export class PlaceBlockPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PlaceBlockPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public block: number;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
        bin.write_u16(this.block);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
        this.block = bin.read_u16();
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

    protected serialize(bin: BinaryBuffer): void {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
    }

    protected getExpectedSize(): number {
        return I32 * 3;
    }
}

export class PingPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PingPacket.id;

    protected serialize(bin: BinaryBuffer): void {
        
    }
    protected deserialize(bin: BinaryBuffer): void {
        
    }
    protected getExpectedSize(): number {
        return 0;
    }
}

export class PingResponsePacket extends Packet {
    static id = Packet.register(() => new this);
    public id = PingResponsePacket.id;

    protected serialize(bin: BinaryBuffer): void {
        
    }
    protected deserialize(bin: BinaryBuffer): void {
        
    }
    protected getExpectedSize(): number {
        return 0;
    }
}

export class KickPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = KickPacket.id;

    public reason: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.reason);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.reason = bin.read_string();
    }
    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.reason);
    }
}

export class SetLocalPlayerPositionPacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = SetLocalPlayerPositionPacket.id;
}

export class ShowUIPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = ShowUIPacket.id;

    public ui: UIContainer;

    protected serialize(bin: BinaryBuffer): void {
        const uiData = JSON.stringify(this.ui.serialize());
        bin.write_string(uiData);
    }
    protected deserialize(bin: BinaryBuffer): void {
        const uiData = JSON.parse(bin.read_string());
        this.ui = UIElement.deserialize(uiData) as UIContainer;
    }
    protected getExpectedSize(): number {
        throw new Error("Method not implemented.");
    }
}