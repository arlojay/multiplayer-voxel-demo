import { BinaryBuffer, CHAR, U8 } from "../binary";
import { Packet, packetRegistry } from "./packet";

export class ClientReadyPacket extends Packet {
    public static id = packetRegistry.register(this);
    public id = ClientReadyPacket.id;

    public username: string;
    public color: string;
    public viewDistance: number;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.username);
        bin.write_charseq(this.color.slice(1, 7).padStart(6, "0"));
        bin.write_u8(this.viewDistance);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.username = bin.read_string();
        this.color = "#" + bin.read_charseq(6);
        this.viewDistance = bin.read_u8();
    }
    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.username) + CHAR * 6 + U8;
    }
}