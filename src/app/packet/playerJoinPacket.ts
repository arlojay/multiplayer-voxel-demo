import { BinaryBuffer, CHAR } from "../serialization/binaryBuffer";
import { ServerPeer } from "../server/serverPeer";
import { packetRegistry } from "./packet";
import { PlayerInfo } from "./playerInfo";

export class PlayerJoinPacket extends PlayerInfo {
    static id = packetRegistry.register(this);
    public id = PlayerJoinPacket.id;

    public player: string;
    public username: string;
    public color: string;

    constructor(peer?: ServerPeer) {
        super(peer?.serverPlayer.base);

        if(peer != null) {
            this.username = peer.username;
            this.color = peer.color;
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        super.serialize(bin);
        bin.write_string(this.player);
        bin.write_string(this.username);
        bin.write_charseq(this.color.slice(0, 6).padStart(6, "0"));
    }

    protected deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.player = bin.read_string();
        this.username = bin.read_string();
        this.color = bin.read_charseq(6);
    }

    protected getExpectedSize(): number {
        return (
            super.getExpectedSize() +
            BinaryBuffer.stringByteCount(this.player) +
            BinaryBuffer.stringByteCount(this.username) +
            CHAR * 6
        );
    }
}