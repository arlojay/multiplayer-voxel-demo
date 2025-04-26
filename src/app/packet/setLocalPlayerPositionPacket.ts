import { Packet } from "./packet";
import { PlayerInfo } from "./playerInfoPacket";

export class SetLocalPlayerPositionPacket extends PlayerInfo {
    static id = Packet.register(() => new this);
    public id = SetLocalPlayerPositionPacket.id;
}