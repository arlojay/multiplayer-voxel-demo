import { BinaryBuffer } from "../serialization/binaryBuffer";
import { StorageLayout } from "../storage/storageLayout";
import { Packet, packetRegistry } from "./packet";

export class UpdateStorageLayoutPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = UpdateStorageLayoutPacket.id;

    public layoutId: string;
    public layoutData: ArrayBuffer;

    public constructor(layout?: StorageLayout) {
        super();

        if(layout != null) {
            this.layoutId = layout.uuid;
            this.layoutData = layout.allocateBuffer();
            layout.write(new BinaryBuffer(this.layoutData));
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.layoutId);
        bin.write_buffer(this.layoutData);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.layoutId = bin.read_string();
        this.layoutData = bin.read_buffer();
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.layoutId) +
            BinaryBuffer.bufferByteCount(this.layoutData)
        )
    }

}