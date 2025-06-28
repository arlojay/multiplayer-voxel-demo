import { BinaryBuffer } from "../serialization/binaryBuffer";
import { SerializedUIContainer } from "../ui";
import { Packet, packetRegistry } from "./packet";

export class OpenUIPacket extends Packet {
    static id = packetRegistry.register(this);
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
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.jsonByteCount(this.ui) +
            BinaryBuffer.stringByteCount(this.interfaceId)
        );
    }
}