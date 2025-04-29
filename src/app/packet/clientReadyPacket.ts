import { BinaryBuffer, CHAR } from "../binary";
import { Packet } from "./packet";

export class ClientReadyPacket extends Packet {
    public static id = Packet.register(() => new this);
    public id = ClientReadyPacket.id;

    public username: string;
    public color: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.username);
        bin.write_string(this.color, 7);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.username = bin.read_string();
        this.color = bin.read_string(7);
    }
    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.username) + CHAR * 7;
    }
}