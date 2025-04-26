import { OpenUIPacket } from "./openUIPacket";
import { Packet } from "./packet";

export class UpdateUIPacket extends OpenUIPacket {
    static id = Packet.register(() => new this);
    public id = UpdateUIPacket.id;
}