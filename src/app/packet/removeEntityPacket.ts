import { BinaryBuffer } from "../binary";
import { BaseEntity } from "../entity/baseEntity";
import { Packet, packetRegistry } from "./packet";

export class RemoveEntityPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = RemoveEntityPacket.id;

    public uuid: string;
    
    public constructor(entity?: BaseEntity) {
        super();

        if(entity != null) {
            this.uuid = entity.uuid;
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid)
        )
    }
}