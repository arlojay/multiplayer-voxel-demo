import { BaseEntity } from "../entity/baseEntity";
import { BinaryBuffer, U32 } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class AddEntityPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = AddEntityPacket.id;

    public type: number;
    public entityData: ArrayBuffer;

    public constructor(entity?: BaseEntity) {
        super();

        if(entity != null) {
            this.type = entity.id;

            const bin = new BinaryBuffer(entity.allocateBuffer());
            entity.write(bin);
            this.entityData = bin.buffer;
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_u32(this.type);
        bin.write_buffer(this.entityData);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.type = bin.read_u32();
        this.entityData = bin.read_buffer();
    }
    protected getExpectedSize(): number {
        return (
            U32 +
            BinaryBuffer.bufferByteCount(this.entityData)
        )
    }
}