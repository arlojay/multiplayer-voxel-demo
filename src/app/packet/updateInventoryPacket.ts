import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Inventory } from "../storage/inventory";
import { Packet, packetRegistry } from "./packet";

export class UpdateInventoryPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = UpdateInventoryPacket.id;

    public inventoryId: string;
    public inventoryData: ArrayBuffer;

    public constructor(inventory?: Inventory) {
        super();

        if(inventory != null) {
            this.inventoryId = inventory.uuid;
            this.inventoryData = inventory.allocateBuffer();
            inventory.write(new BinaryBuffer(this.inventoryData));
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.inventoryId);
        bin.write_buffer(this.inventoryData);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.inventoryId = bin.read_string();
        this.inventoryData = bin.read_buffer();
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.inventoryId) +
            BinaryBuffer.bufferByteCount(this.inventoryData)
        )
    }

}