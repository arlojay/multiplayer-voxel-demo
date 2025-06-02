import { packetRegistry } from "./packet";
import { PlayerInfo } from "./playerInfo";


export class ClientMovePacket extends PlayerInfo {
    static id = packetRegistry.register(this);
    public id = ClientMovePacket.id;
}