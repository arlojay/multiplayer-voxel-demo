import { BinaryBuffer, U32 } from "../binary";
import { BaseEntity } from "../entity/baseEntity";
import { Packet, packetRegistry } from "./packet";

export class AddEntityPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = AddEntityPacket.id;

    public uuid: string;
    public type: number;
    public entityData: ArrayBuffer;

    public constructor(entity?: BaseEntity) {
        super();

        if(entity != null) {
            this.uuid = entity.uuid;
            this.type = entity.id;

            const bin = new BinaryBuffer(entity.allocateBuffer());
            entity.write(bin);
            this.entityData = bin.buffer;
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_u32(this.type);
        bin.write_buffer(this.entityData);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.type = bin.read_u32();
        this.entityData = bin.read_buffer();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            U32 +
            BinaryBuffer.bufferByteCount(this.entityData)
        )
    }
}