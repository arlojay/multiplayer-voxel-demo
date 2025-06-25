import { BinaryBuffer } from "../serialization/binaryBuffer";
import { SerializedUIElement, UIElement } from "../ui";
import { Packet, packetRegistry } from "./packet";

export class InsertUIElementPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = InsertUIElementPacket.id;

    public path: number[];
    public interfaceId: string;
    public element: SerializedUIElement;
    
    public constructor(interfaceId?: string, path?: number[], element?: UIElement) {
        super();
        if(interfaceId != null) this.interfaceId = interfaceId;
        if(path != null) this.path = path;
        if(element != null) this.element = element.serialize();
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.interfaceId);
        bin.write_buffer(new Uint32Array(this.path).buffer);
        bin.write_json(this.element);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.interfaceId = bin.read_string();
        this.path = Array.from(new Uint32Array(bin.read_buffer()));
        this.element = bin.read_json();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.interfaceId) +
            BinaryBuffer.bufferByteCount(new Uint32Array(this.path).buffer) +
            BinaryBuffer.jsonByteCount(this.element)
        );
    }
}