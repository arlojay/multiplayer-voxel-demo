import { BinaryBuffer } from "../binary";
import { Packet, packetRegistry } from "./packet";


export class PlayerLeavePacket extends Packet {
    static id = packetRegistry.register(this);
    public id = PlayerLeavePacket.id;

    public player: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.player);
    }

    protected deserialize(bin: BinaryBuffer): void {
        this.player = bin.read_string();
    }

    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.player);
    }
}