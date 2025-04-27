import { BinaryBuffer } from "../binary";
import { Packet } from "./packet";

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