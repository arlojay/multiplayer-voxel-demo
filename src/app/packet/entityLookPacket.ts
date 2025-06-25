import { BaseEntity, RotatingEntity } from "../entity/baseEntity";
import { BinaryBuffer, F32 } from "../serialization/binaryBuffer";
import { EntityPacket } from "./entityPacket";
import { Packet, packetRegistry } from "./packet";

export class EntityLookPacket extends Packet implements EntityPacket {
    public static readonly id = packetRegistry.register(this);
    public readonly id = EntityLookPacket.id;

    public uuid: string;
    
    public pitch: number;
    public yaw: number;

    public constructor(entity?: BaseEntity & RotatingEntity) {
        super();

        if(entity == null) return;

        this.uuid = entity.uuid;

        this.pitch = entity.rotation.pitch;
        this.yaw = entity.rotation.yaw;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_f32(this.pitch);
        bin.write_f32(this.yaw);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.pitch = bin.read_f32();
        this.yaw = bin.read_f32();
    }

    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            (F32 * 2)
        );
    }
}