import { BinaryBuffer } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry } from "../ui";
import { Packet, packetRegistry } from "./packet";

export class UpdateUIElementPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = UpdateUIElementPacket.id;

    public path: number[];
    public interfaceId: string;
    public elementData: ArrayBuffer;

    public constructor(interfaceId?: string, path?: number[], element?: UIElement) {
        super();
        if(interfaceId != null) this.interfaceId = interfaceId;
        if(path != null) this.path = path;
        if(element != null) {
            this.elementData = element.allocateBuffer();
            element.serialize(new BinaryBuffer(this.elementData));
        }
    }
    
    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.interfaceId);
        bin.write_buffer(new Uint32Array(this.path).buffer);
        bin.write_buffer(this.elementData);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.interfaceId = bin.read_string();
        this.path = Array.from(new Uint32Array(bin.read_buffer()));
        this.elementData = bin.read_buffer();
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.interfaceId) +
            BinaryBuffer.bufferByteCount(new Uint32Array(this.path).buffer) +
            BinaryBuffer.bufferByteCount(this.elementData)
        );
    }
}