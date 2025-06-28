import { BlockStateSaveKey } from "../block/blockState";
import { Player } from "../entity/impl";
import { BinaryBuffer, BOOL, I32, U16 } from "../serialization/binaryBuffer";
import { CHUNK_SIZE } from "../world/voxelGrid";
import { Chunk } from "../world/world";
import { Packet, packetRegistry } from "./packet";

export class ChunkDataPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = ChunkDataPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public homogeneousBlock: number;
    public data: Uint16Array = new Uint16Array(CHUNK_SIZE ** 3);
    public entityData: ArrayBuffer[];
    public palette: BlockStateSaveKey[];

    public constructor(chunk?: Chunk) {
        super();

        if(chunk != null) {
            this.x = chunk.x;
            this.y = chunk.y;
            this.z = chunk.z;
            this.homogeneousBlock = chunk.getHomogeneousBlock();
            this.data = chunk.data;

            this.entityData = chunk.entities.values()
                .filter(entity => !(entity instanceof Player))
                .map(entity => {
                    const data = new BinaryBuffer(entity.allocateBuffer());
                    entity.write(data);
                    return data.buffer;
                })
                .toArray();
            this.palette = chunk.flatPalette;
        }
    }

    protected deserialize(bin: BinaryBuffer) {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();

        if(bin.read_boolean()) {
            this.data.fill(this.homogeneousBlock = bin.read_u16());
        } else {
            this.homogeneousBlock = -1;
            this.data.set(new Uint16Array(bin.read_buffer()));
        }
        const paletteSize = bin.read_u16();
        this.palette = new Array;
        for(let i = 0; i < paletteSize; i++) {
            this.palette.push(bin.read_string() as BlockStateSaveKey);
        }

        const entityCount = bin.read_u16();
        if(entityCount > 0) {
            this.entityData = new Array;
        }
        for(let i = 0; i < entityCount; i++) {
            this.entityData.push(bin.read_buffer());
        }
    }

    protected serialize(bin: BinaryBuffer) {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);

        if(this.homogeneousBlock == -1) {
            bin.write_boolean(false);
            bin.write_buffer(this.data.buffer as ArrayBuffer);
        } else {
            bin.write_boolean(true);
            bin.write_u16(this.homogeneousBlock);
        }

        bin.write_u16(this.palette.length);
        for(const item of this.palette) bin.write_string(item);

        bin.write_u16(this.entityData.length);
        for(const data of this.entityData) {
            bin.write_buffer(data);
        }
    }

    protected getOwnExpectedSize() {
        let paletteBytes = 0;
        for(const paletteItem of this.palette) paletteBytes += BinaryBuffer.stringByteCount(paletteItem);

        return (
            (I32 * 3) +
            BOOL +
            (
                this.homogeneousBlock == -1 ? BinaryBuffer.bufferByteCount(this.data.buffer as ArrayBuffer) : U16
            ) +
            U16 + paletteBytes +
            U16 +
            (
                this.entityData.length == 0
                ? 0
                : this.entityData.reduce((size, data) => size + BinaryBuffer.bufferByteCount(data), 0)
            )
        );
    }
}