import { BinaryBuffer, BOOL } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry } from "../ui";
import { Packet, packetRegistry } from "./packet";

export class OpenUIPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = OpenUIPacket.id;

    public ui: UIElement;
    public interfaceId: string;
    public blocking: boolean;
    public spotlight: boolean;
    public closable: boolean;

    constructor(ui?: UIElement, interfaceId?: string) {
        super();
        if(ui != null) this.ui = ui;
        if(interfaceId != null) this.interfaceId = interfaceId;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.interfaceId);
        bin.write_boolean(this.blocking);
        bin.write_boolean(this.spotlight);
        bin.write_boolean(this.closable);
        this.ui.write(bin);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.interfaceId = bin.read_string();
        this.blocking = bin.read_boolean();
        this.spotlight = bin.read_boolean();
        this.closable = bin.read_boolean();
        this.ui = UIElementRegistry.createFromBinary(bin);
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.interfaceId) +
            BOOL +
            BOOL +
            BOOL +
            this.ui.getExpectedSize()
        );
    }
}