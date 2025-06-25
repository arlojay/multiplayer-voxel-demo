import { capabilities } from "../capability";
import { BinaryBuffer, MAX_U32, U16, U32 } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class SplitPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = SplitPacket.id;

    public packetData: ArrayBuffer;
    public bufferIndex: number;
    public packetCount: number;
    public packetNonce: number;

    public constructor(nonce?: number, index?: number, maxCount?: number, data?: ArrayBuffer) {
        super();

        if(nonce != null) this.packetNonce = nonce;
        if(index != null) this.bufferIndex = index;
        if(maxCount != null) this.packetCount = maxCount;
        if(data != null) this.packetData = data;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_u32(this.packetNonce);
        bin.write_u16(this.bufferIndex);
        bin.write_u16(this.packetCount);
        bin.write_buffer(this.packetData);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.packetNonce = bin.read_u32();
        this.bufferIndex = bin.read_u16();
        this.packetCount = bin.read_u16();
        this.packetData = bin.read_buffer();
    }
    protected getExpectedSize(): number {
        return (
            U32 + U16 + U16 +
            BinaryBuffer.bufferByteCount(this.packetData)
        )
    }
}

export function splitPacket(packet: Packet, maxSize = capabilities.MAX_WEBRTC_PACKET_SIZE): Packet[] {
    const buffer = packet.allocateBuffer();
    if(buffer.byteLength < maxSize) return [ packet ];

    const bin = new BinaryBuffer(buffer);
    packet.write(bin);

    const sections: ArrayBuffer[] = new Array;
    for(let i = 0; i < buffer.byteLength; i += maxSize) {
        sections.push(buffer.slice(i, Math.min(i + maxSize, buffer.byteLength)));
    }
    
    const nonce = Math.floor(Math.random() * MAX_U32);
    return sections.map((slicedBuffer, index) => new SplitPacket(nonce, index, sections.length, slicedBuffer));
}

interface SplitPacketList {
    packets: SplitPacket[];
    nonce: number;
    packetCount: number;
    fulfilled: number;
}

export class SplitPacketAssembler {
    private parts: Map<number, SplitPacketList> = new Map;

    public addPart(part: SplitPacket): ArrayBuffer | null {
        let partList = this.parts.get(part.packetNonce);
        if(partList == null) this.parts.set(part.packetNonce, partList = {
            packets: new Array(part.packetCount),
            nonce: part.packetNonce,
            packetCount: part.packetCount,
            fulfilled: 0
        });

        partList.packets[part.bufferIndex] = part;
        partList.fulfilled++;

        if(partList.fulfilled == partList.packetCount) {
            return this.assemble(partList);
        }
        return null;
    }

    private assemble(partList: SplitPacketList) {
        const buffers = partList.packets.map(v => v.packetData);
        const buffer = new ArrayBuffer(buffers.reduce((size, buffer) => size + buffer.byteLength, 0));
        const bufferView = new Uint8Array(buffer);
        
        let i = 0;
        for(const bufferPart of buffers) {
            bufferView.set(new Uint8Array(bufferPart), i);
            i += bufferPart.byteLength;
        }

        this.parts.delete(partList.nonce);

        return buffer;
    }
}