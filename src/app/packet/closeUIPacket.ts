import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class CloseUIPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = CloseUIPacket.id;

    public interfaceId: string;
    
    constructor(interfaceId?: string) {
        super();
        if(interfaceId != null) this.interfaceId = interfaceId;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.interfaceId);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.interfaceId = bin.read_string();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.interfaceId)
        );
    }
}