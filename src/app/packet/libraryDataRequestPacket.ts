import { BinaryBuffer } from "../binary";
import { Packet, packetRegistry } from "./packet";

export class LibraryDataRequestPacket extends Packet {
    public static id = packetRegistry.register(this);
    public id = LibraryDataRequestPacket.id;
    
    public location: string;

    public constructor(location?: string) {
        super();
        if(location != null) this.location = location;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.location);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.location = bin.read_string();
    }
    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.location);
    }
}