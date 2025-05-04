import { BinaryBuffer, CHAR } from "../binary";
import { Packet } from "./packet";

export class ClientReadyPacket extends Packet {
    public static id = Packet.register(() => new this);
    public id = ClientReadyPacket.id;

    public username: string;
    public color: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.username);
        bin.write_charseq(this.color.slice(1, 7).padStart(6, "0"));
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.username = bin.read_string();
        this.color = "#" + bin.read_charseq(6);
    }
    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.username) + 6 * CHAR;
    }
}