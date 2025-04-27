import { BinaryBuffer, F32 } from "../binary";
import { ServerPlayer } from "../server/serverPlayer";
import { Packet } from "./packet";

export abstract class PlayerInfo extends Packet {
    public x: number;
    public y: number;
    public z: number;
    public vx: number;
    public vy: number;
    public vz: number;
    public yaw: number;
    public pitch: number;

    public constructor(player?: ServerPlayer) {
        super();

        if(player == null) return;

        [ this.x, this.y, this.z ] = player.position.toArray();
        [ this.vx, this.vy, this.vz ] = player.velocity.toArray();
        [ this.yaw, this.pitch ] = [ player.yaw, player.pitch ];
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_f32(this.x);
        bin.write_f32(this.y);
        bin.write_f32(this.z);
        bin.write_f32(this.vx);
        bin.write_f32(this.vy);
        bin.write_f32(this.vz);
        bin.write_f32(this.yaw);
        bin.write_f32(this.pitch);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.x = bin.read_f32();
        this.y = bin.read_f32();
        this.z = bin.read_f32();
        this.vx = bin.read_f32();
        this.vy = bin.read_f32();
        this.vz = bin.read_f32();
        this.yaw = bin.read_f32();
        this.pitch = bin.read_f32();
    }

    protected getExpectedSize(): number {
        return (F32 * 3) + (F32 * 3) + (F32 * 2);
    }
}