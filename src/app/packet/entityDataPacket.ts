import { BaseEntity } from "../entity/baseEntity";
import { BinaryBuffer } from "../serialization/binaryBuffer";
import { EntityPacket } from "./entityPacket";
import { Packet, packetRegistry } from "./packet";

export class EntityDataPacket extends Packet implements EntityPacket {
    public static readonly id = packetRegistry.register(this);
    public readonly id = EntityDataPacket.id;
    
    public uuid: string;
    public data: ArrayBuffer;

    constructor(entity?: BaseEntity) {
        super();

        if(entity != null) {
            this.uuid = entity.uuid;

            const bin = new BinaryBuffer(entity.allocateExtraDataBuffer());
            entity.writeExtraData(bin);
            this.data = bin.buffer;
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_buffer(this.data);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.data = bin.read_buffer();
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            BinaryBuffer.bufferByteCount(this.data)
        );
    }
}