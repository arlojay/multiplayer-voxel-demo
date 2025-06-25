import { Vector3 } from "three";
import { Player } from "../entity/impl";
import { BinaryBuffer, F16, VEC3 } from "../serialization/binaryBuffer";
import { Packet } from "./packet";

export abstract class PlayerInfo extends Packet {
    public abstract id: number;
    
    public position = new Vector3;
    public velocity = new Vector3;
    public pitch: number;
    public yaw: number;

    public constructor(player?: Player) {
        super();
        if(player != null) {
            this.position.copy(player.position);
            this.velocity.copy(player.velocity);
            this.pitch = player.rotation.pitch;
            this.yaw = player.rotation.yaw;
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_vec3(this.position);
        bin.write_vec3(this.velocity);
        bin.write_f16(this.pitch);
        bin.write_f16(this.yaw);
    }

    protected deserialize(bin: BinaryBuffer): void {
        bin.read_vec3(this.position);
        bin.read_vec3(this.velocity);
        this.pitch = bin.read_f16();
        this.yaw = bin.read_f16();
    }

    protected getExpectedSize(): number {
        return VEC3 + VEC3 + F16 * 2;
    }
}