import { BinaryBuffer, U16 } from "../binary";
import { Packet, packetRegistry } from "./packet";

export class CombinedPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = CombinedPacket.id;
    
    public packets: Set<ArrayBuffer> = new Set;

    public addPacket(packet: Packet) {
        const bin = new BinaryBuffer(packet.allocateBuffer());
        packet.write(bin);
        this.packets.add(bin.buffer);
    }

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

export function combinePackets(...packets: (Packet | null)[]): Packet | null {
    packets = packets.filter(v => v != null);

    if(packets.length == 0) return null;
    if(packets.length == 1) return packets[0];
    
    const combinedPacket = new CombinedPacket();
    for(const packet of packets) {
        combinedPacket.addPacket(packet);
    }

    return combinedPacket;
}