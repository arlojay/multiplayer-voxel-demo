import { BinaryBuffer } from "../binary";
import { Packet } from "./packet";


export class PlayerLeavePacket extends Packet {
    static id = Packet.register(() => new this);
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