import { Packet, packetRegistry } from "./packet";
import { PlayerInfo } from "./playerInfo";

export class SetLocalPlayerPositionPacket extends PlayerInfo {
    static id = packetRegistry.register(this);
    public id = SetLocalPlayerPositionPacket.id;
}