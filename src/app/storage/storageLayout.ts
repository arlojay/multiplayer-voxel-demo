import { BinaryBuffer, F32, U16 } from "../serialization/binaryBuffer";
import { Serializable } from "../serialization/serializable";
import { Box2 } from "three";
import { Inventory } from "./inventory";

export class PositionedStorageSlot extends Serializable {
    public slotIndex = 0;
    public x = 0;
    public y = 0;

    public constructor(slotIndex?: number) {
        super();

        if(slotIndex != null) this.slotIndex = slotIndex;
    }
    public getInventorySlot(inventory: Inventory) {
        return inventory.getSlot(this.slotIndex);
    }
    
    public serialize(bin: BinaryBuffer): void {
        bin.write_u16(this.slotIndex);
        bin.write_f32(this.x);
        bin.write_f32(this.y);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.slotIndex = bin.read_u16();
        this.x = bin.read_f32();
        this.y = bin.read_f32();
    }
    public getExpectedSize(): number {
        return U16 + F32 + F32;
    }
}

export class StorageLayout extends Serializable {
    public uuid: string = crypto.randomUUID();
    private slots: PositionedStorageSlot[] = new Array;
    private slotsInverse: Map<PositionedStorageSlot, number> = new Map;
    
    public setSlotPosition(slotIndex: number, x: number, y: number): PositionedStorageSlot {        
        const positionedSlot = this.slots[slotIndex] ??= new PositionedStorageSlot(slotIndex);
        positionedSlot.x = x;
        positionedSlot.y = y;
        this.slotsInverse.set(positionedSlot, slotIndex);

        return positionedSlot;
    }
    public getSlotIndex(slot: PositionedStorageSlot) {
        return this.slotsInverse.get(slot);
    }
    public getSlot(index: number) {
        return this.slots[index];
    }
    public findClosestSlot(x: number, y: number): [ PositionedStorageSlot, number ] {
        let bestDistance = Infinity;
        let bestSlot = null;

        for(const slot of this.slots.values()) {
            const dist = (x - slot.x) ** 2 + (y - slot.y) ** 2;
            if(dist < bestDistance) {
                bestDistance = dist;
                bestSlot = slot;
            }
        }

        return [ bestSlot, bestDistance ];
    }

    public getBounds(): Box2;
    public getBounds(out: Box2): Box2;
    public getBounds(out: Box2 = new Box2) {
        out.min.x = Infinity;
        out.max.x = -Infinity;
        out.min.y = Infinity;
        out.max.y = -Infinity;

        for(const slot of this.slots.values()) {
            if(slot.x > out.max.x) out.max.x = slot.x;
            if(slot.y > out.max.y) out.max.y = slot.y;
            if(slot.x < out.min.x) out.min.x = slot.x;
            if(slot.y < out.min.y) out.min.y = slot.y;
        }

        out.max.x++;
        out.max.y++;
        return out;
    }
    public slotCount() {
        return this.slots.length;
    }
    public allSlots() {
        return this.slots.values();
    }
    
    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_u16(this.slots.length);

        for(const slot of this.slots.values()) {
            slot.write(bin);
        }
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        const slotCount = bin.read_u16();

        for(let i = 0; i < slotCount; i++) {
            const slot = new PositionedStorageSlot;
            slot.read(bin);

            this.slots[slot.slotIndex] = slot;
            this.slotsInverse.set(slot, slot.slotIndex);
        }
    }
    public getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            U16 +
            this.slots.reduce((size, slot) => size + slot.getExpectedSize(), 0)
        )
    }
}