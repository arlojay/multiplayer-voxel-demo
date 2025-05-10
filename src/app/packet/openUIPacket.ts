import { BinaryBuffer } from "../binary";
import { SerializedUIContainer } from "../ui";
import { Packet } from "./packet";

export class OpenUIPacket extends Packet {
    static id = Packet.register(() => new this);
    public id = OpenUIPacket.id;

    public ui: SerializedUIContainer;
    public interfaceId: string;

    constructor(ui?: SerializedUIContainer, interfaceId?: string) {
        super();
        if(ui != null) this.ui = ui;
        if(interfaceId != null) this.interfaceId = interfaceId;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_json(this.ui);
        bin.write_string(this.interfaceId);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.ui = bin.read_json();
        this.interfaceId = bin.read_string();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.jsonByteCount(this.ui) +
            BinaryBuffer.stringByteCount(this.interfaceId)
        );
    }
}