import { BinaryBuffer, U16, U8 } from "../serialization/binaryBuffer";
import { Inventory } from "../storage/inventory";
import { InventoryInteractionType } from "../storage/storageInterface";
import { Packet, packetRegistry } from "./packet";

export class InventoryInteractionPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = InventoryInteractionPacket.id;

    public inventoryId: string;
    public slotIndex: number;
    public interactionType: InventoryInteractionType;


    public constructor(interactionType?: InventoryInteractionType, inventory?: Inventory, slotIndex?: number) {
        super();

        if(interactionType != null) {
            this.interactionType = interactionType;
        }
        if(inventory != null) {
            this.inventoryId = inventory.uuid;
        }
        if(slotIndex != null) {
            this.slotIndex = slotIndex;
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.inventoryId);
        bin.write_u8(this.interactionType);
        bin.write_u16(this.slotIndex);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.inventoryId = bin.read_string();
        this.interactionType = bin.read_u8();
        this.slotIndex = bin.read_u16();
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.inventoryId) +
            U8 + U16
        );
    }

}