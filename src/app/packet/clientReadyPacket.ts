import { BinaryBuffer } from "../binary";
import { Packet } from "./packet";

export class ClientReadyPacket extends Packet {
    public static id = Packet.register(() => new this);
    public id = ClientReadyPacket.id;

    public username: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.username);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.username = bin.read_string();
    }
    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.username);
    }

}