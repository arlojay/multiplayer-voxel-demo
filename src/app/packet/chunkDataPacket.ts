import { BinaryBuffer, I32, U16 } from "../binary";
import { CHUNK_SIZE } from "../voxelGrid";
import { GetChunkPacket } from "./getChunkPacket";
import { Packet } from "./packet";

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