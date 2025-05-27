import { BinaryBuffer, F32 } from "../binary";
import { BaseEntity } from "../entity/baseEntity";
import { Packet, packetRegistry } from "./packet";

export class EntityMovePacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = EntityMovePacket.id;

    public uuid: string;

    public x: number;
    public y: number;
    public z: number;
    public vx: number;
    public vy: number;
    public vz: number;

    public constructor(entity?: BaseEntity) {
        super();

        if(entity == null) return;

        this.uuid = entity.uuid;

        [ this.x, this.y, this.z ] = entity.position.toArray();
        [ this.vx, this.vy, this.vz ] = entity.velocity.toArray();
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_f32(this.x);
        bin.write_f32(this.y);
        bin.write_f32(this.z);
        bin.write_f32(this.vx);
        bin.write_f32(this.vy);
        bin.write_f32(this.vz);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.x = bin.read_f32();
        this.y = bin.read_f32();
        this.z = bin.read_f32();
        this.vx = bin.read_f32();
        this.vy = bin.read_f32();
        this.vz = bin.read_f32();
    }

    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            (F32 * 3) +
            (F32 * 3)
        );
    }
}