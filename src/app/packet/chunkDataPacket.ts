import { BinaryBuffer, I32, U16 } from "../binary";
import { Player } from "../entity/impl";
import { CHUNK_SIZE } from "../voxelGrid";
import { Chunk } from "../world";
import { Packet, packetRegistry } from "./packet";

export class ChunkDataPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = ChunkDataPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public data: Uint16Array = new Uint16Array(CHUNK_SIZE ** 3);
    public entityData: ArrayBuffer[];

    public constructor(chunk?: Chunk) {
        super();

        if(chunk != null) {
            this.x = chunk.x;
            this.y = chunk.y;
            this.z = chunk.z;
            this.data = chunk.data;
            this.entityData = chunk.entities.values()
                .filter(entity => !(entity instanceof Player))
                .map(entity => {
                    const data = new BinaryBuffer(entity.allocateBuffer());
                    entity.write(data);
                    return data.buffer;
                })
                .toArray();
        }
    }

    protected deserialize(bin: BinaryBuffer) {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();

        this.data.set(new Uint16Array(bin.read_buffer()));

        const entityCount = bin.read_u16();
        if(entityCount > 0) {
            this.entityData ??= new Array;
            this.entityData.splice(0);
        }
        for(let i = 0; i < entityCount; i++) {
            this.entityData.push(bin.read_buffer());
        }
    }

    protected serialize(sink: BinaryBuffer) {
        sink.write_i32(this.x);
        sink.write_i32(this.y);
        sink.write_i32(this.z);

        sink.write_buffer(this.data.buffer as ArrayBuffer);

        sink.write_u16(this.entityData.length);
        for(const data of this.entityData) {
            sink.write_buffer(data);
        }
    }

    protected getExpectedSize() {
        return (
            (I32 * 3) +
            BinaryBuffer.bufferByteCount(this.data.buffer as ArrayBuffer) +
            U16 +
            (
                this.entityData.length == 0
                ? 0
                : this.entityData.reduce((size, data) => size + BinaryBuffer.bufferByteCount(data), 0)
            )
        );
    }
}