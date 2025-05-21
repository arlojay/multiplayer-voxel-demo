import { BinaryBuffer } from "../binary";
import { Packet, packetRegistry } from "./packet";
import { PlayerInfo } from "./playerInfoPacket";


export class ClientMovePacket extends PlayerInfo {
    static id = packetRegistry.register(this);
    public id = ClientMovePacket.id

    protected serialize(bin: BinaryBuffer): void {
        super.serialize(bin);
    }

    protected deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
    }

    protected getExpectedSize(): number {
        return super.getExpectedSize();
    }
}