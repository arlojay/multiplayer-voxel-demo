import { BinaryBuffer, U16 } from "../binary";
import { Packet } from "./packet";

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