import { $enum } from "ts-enum-util";
import { BlockFace } from "../block/block";
import { BinaryBuffer, F32, I32, U8 } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class InteractBlockPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = InteractBlockPacket.id;

    public x: number;
    public y: number;
    public z: number;
    public pointX: number;
    public pointY: number;
    public pointZ: number;
    public face: number;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_i32(this.x);
        bin.write_i32(this.y);
        bin.write_i32(this.z);
        bin.write_f32(this.pointX);
        bin.write_f32(this.pointY);
        bin.write_f32(this.pointZ);
        bin.write_u8(this.face);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.x = bin.read_i32();
        this.y = bin.read_i32();
        this.z = bin.read_i32();
        this.pointX = bin.read_f32();
        this.pointY = bin.read_f32();
        this.pointZ = bin.read_f32();
        this.face = $enum(BlockFace).asValueOrThrow(bin.read_u8());
    }
    protected getExpectedSize(): number {
        return I32 * 3 + F32 * 3 + U8;
    }
}