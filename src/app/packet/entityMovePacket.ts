import { BaseEntity } from "../entity/baseEntity";
import { BinaryBuffer, BOOL, F32 } from "../serialization/binaryBuffer";
import { EntityPacket } from "./entityPacket";
import { Packet, packetRegistry } from "./packet";

export class EntityMovePacket extends Packet implements EntityPacket {
    public static readonly id = packetRegistry.register(this);
    public readonly id = EntityMovePacket.id;

    public uuid: string;
    
    public x: number;
    public y: number;
    public z: number;
    public vx: number;
    public vy: number;
    public vz: number;
    public ax: number;
    public ay: number;
    public az: number;
    public dx: number;
    public dy: number;
    public dz: number;

    public skipInterpolation = false;

    public constructor(entity?: BaseEntity, skipInterpolation?: boolean) {
        super();

        if(entity == null) return;

        this.uuid = entity.uuid;

        [ this.x, this.y, this.z ] = entity.position.toArray();
        [ this.vx, this.vy, this.vz ] = entity.velocity.toArray();
        [ this.ax, this.ay, this.az ] = entity.acceleration.toArray();
        [ this.dx, this.dy, this.dz ] = entity.drag.toArray();
        if(skipInterpolation != null) this.skipInterpolation = skipInterpolation;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_f32(this.x);
        bin.write_f32(this.y);
        bin.write_f32(this.z);
        bin.write_f32(this.vx);
        bin.write_f32(this.vy);
        bin.write_f32(this.vz);
        bin.write_boolean(this.skipInterpolation);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.x = bin.read_f32();
        this.y = bin.read_f32();
        this.z = bin.read_f32();
        this.vx = bin.read_f32();
        this.vy = bin.read_f32();
        this.vz = bin.read_f32();
        this.ax = bin.read_f32();
        this.ay = bin.read_f32();
        this.az = bin.read_f32();
        this.dx = bin.read_f32();
        this.dy = bin.read_f32();
        this.dz = bin.read_f32();
        this.skipInterpolation = bin.read_boolean();
    }

    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            (F32 * 3) +
            (F32 * 3) +
            (F32 * 3) +
            (F32 * 3) +
            BOOL
        );
    }
}