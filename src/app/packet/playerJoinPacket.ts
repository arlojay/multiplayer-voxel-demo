import { BinaryBuffer } from "../binary";
import { Packet } from "./packet";
import { PlayerInfo } from "./playerInfoPacket";

export class PlayerJoinPacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = PlayerJoinPacket.id;

    public player: string;

    protected serialize(bin: BinaryBuffer): void {
        super.serialize(bin);
        bin.write_string(this.player);
    }

    protected deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.player = bin.read_string();
    }

    protected getExpectedSize(): number {
        return super.getExpectedSize() + BinaryBuffer.stringByteCount(this.player);
    }
}