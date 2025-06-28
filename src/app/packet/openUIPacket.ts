import { BinaryBuffer } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry } from "../ui";
import { Packet, packetRegistry } from "./packet";

export class OpenUIPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = OpenUIPacket.id;

    public ui: UIElement;
    public interfaceId: string;

    constructor(ui?: UIElement, interfaceId?: string) {
        super();
        if(ui != null) this.ui = ui;
        if(interfaceId != null) this.interfaceId = interfaceId;
    }

    protected serialize(bin: BinaryBuffer): void {
        this.ui.write(bin);
        bin.write_string(this.interfaceId);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.ui = UIElementRegistry.createFromBinary(bin);
        this.interfaceId = bin.read_string();
    }
    protected getOwnExpectedSize(): number {
        return (
            this.ui.getExpectedSize() +
            BinaryBuffer.stringByteCount(this.interfaceId)
        );
    }
}