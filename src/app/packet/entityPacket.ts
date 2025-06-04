import { Packet } from "./packet";

export interface EntityPacket extends Packet {
    uuid: string;
}