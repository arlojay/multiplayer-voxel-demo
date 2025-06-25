import { BinaryBuffer } from "../serialization/binaryBuffer";
import { packetRegistry } from "./packet";
import { PlayerInfo } from "./playerInfo";


export class PlayerMovePacket extends PlayerInfo {
    static id = packetRegistry.register(this);
    public id = PlayerMovePacket.id;

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