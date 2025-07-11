import { BinaryBuffer } from "../serialization/binaryBuffer";
import { World } from "../world/world";
import { Packet, packetRegistry } from "./packet";

export class ChangeWorldPacket extends Packet {
    public static id = packetRegistry.register(this);
    public id = ChangeWorldPacket.id;
    public world: string;

    public constructor(world?: World) {
        super();
        if(world != null) this.world = world.id;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.world);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.world = bin.read_string();
    }

    protected getOwnExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.world);
    }
}