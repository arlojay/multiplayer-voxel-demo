import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class PingResponsePacket extends Packet {
    static id = packetRegistry.register(this);
    public id = PingResponsePacket.id;

    protected serialize(bin: BinaryBuffer): void {
        
    }
    protected deserialize(bin: BinaryBuffer): void {
        
    }
    protected getOwnExpectedSize(): number {
        return 0;
    }
}