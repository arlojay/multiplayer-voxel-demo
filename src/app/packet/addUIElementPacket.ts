import { BinaryBuffer } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry } from "../ui";
import { Packet, packetRegistry } from "./packet";

export class InsertUIElementPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = InsertUIElementPacket.id;

    public path: number[];
    public interfaceId: string;
    public element: UIElement;
    
    public constructor(interfaceId?: string, path?: number[], element?: UIElement) {
        super();
        if(interfaceId != null) this.interfaceId = interfaceId;
        if(path != null) this.path = path;
        if(element != null) this.element = element;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.interfaceId);
        bin.write_buffer(new Uint32Array(this.path).buffer);
        this.element.write(bin);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.interfaceId = bin.read_string();
        this.path = Array.from(new Uint32Array(bin.read_buffer()));
        this.element = UIElementRegistry.createFromBinary(bin);
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.interfaceId) +
            BinaryBuffer.bufferByteCount(new Uint32Array(this.path).buffer) +
            this.element.getExpectedSize()
        );
    }
}