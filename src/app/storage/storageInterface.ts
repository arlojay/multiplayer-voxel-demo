import { TypedEmitter } from "tiny-typed-emitter";
import { Inventory, StorageSlot } from "./inventory";

export enum InventoryInteractionType {
    PICK_UP_STACK,
    DROP_STACK,
    SPLIT_STACK,
    DROP_ONE,
    MERGE_STACK,
    SWAP_STACK
}

export class StorageInterface extends TypedEmitter<{
    "dropone": (index: number) => void;
    "dropstack": (index: number) => void;
    "mergestack": (index: number) => void;
    "pickupstack": (index: number) => void;
    "splitstack": (index: number) => void;
    "swapstack": (index: number) => void;
    "operation": (index: number, interactionType: InventoryInteractionType) => void;
    "update": (slot: StorageSlot) => void;
    "updateall": () => void;
}> {
    private inventory: Inventory;
    private movingSlot: StorageSlot;

    public constructor(inventory: Inventory, movingSlot: StorageSlot) {
        super();
        this.inventory = inventory;
        this.movingSlot = movingSlot;
    }
    
    public getMovingSlot() {
        return this.movingSlot;
    }
    public getTargetInventory() {
        return this.inventory;
    }

    public dropOne(slotIndex: number): void {
        const slot = this.inventory.getSlot(slotIndex);
        console.log("drop one", slot.stack, this.movingSlot);
        
        if(this.movingSlot.isEmpty()) throw new ReferenceError("Failed to drop one; moving slot is empty");
        
        const taken = this.movingSlot.stack.take(1);
        console.log("taken", taken);
        const remainder = slot.addStack(taken);
        this.movingSlot.addStack(remainder);

        this.movingSlot.update();
        slot.update();

        this.emit("dropone", slotIndex);
        this.emit("operation", slotIndex, InventoryInteractionType.DROP_ONE);
        this.emit("update", this.movingSlot);
        this.emit("update", slot);
    }
    public dropStack(slotIndex: number): void {
        const slot = this.inventory.getSlot(slotIndex);
        console.log("drop stack", slot.stack, this.movingSlot);

        if(!slot.isEmpty()) throw new ReferenceError("Failed to drop stack; target slot is not empty");
        if(this.movingSlot.isEmpty()) throw new ReferenceError("Failed to drop stack; moving slot is empty");

        slot.setStack(this.movingSlot.stack);
        this.movingSlot.clear();

        this.movingSlot.update();
        slot.update();

        this.emit("dropstack", slotIndex);
        this.emit("operation", slotIndex, InventoryInteractionType.DROP_STACK);
        this.emit("update", this.movingSlot);
        this.emit("update", slot);
    }
    public mergeStack(slotIndex: number): void {
        const slot = this.inventory.getSlot(slotIndex);
        console.log("merge stack", slot.stack, this.movingSlot);

        if(slot.isEmpty()) throw new ReferenceError("Failed to merge stack; target slot is empty");
        if(this.movingSlot.isEmpty()) throw new ReferenceError("Failed to merge stack; moving slot is empty");

        const remainder = slot.addStack(this.movingSlot.stack);
        this.movingSlot.setStack(remainder);
        
        this.movingSlot.update();
        slot.update();

        this.emit("mergestack", slotIndex);
        this.emit("operation", slotIndex, InventoryInteractionType.MERGE_STACK);
        this.emit("update", this.movingSlot);
        this.emit("update", slot);
    }
    public pickUpStack(slotIndex: number): void {
        const slot = this.inventory.getSlot(slotIndex);
        console.log("pick up stack", slot.stack, this.movingSlot);
        
        if(slot.isEmpty()) throw new ReferenceError("Failed to pick up stack; target slot is empty");
        if(!this.movingSlot.isEmpty()) throw new ReferenceError("Failed to pick up stack; moving slot is not empty");
        
        this.movingSlot.setStack(slot.stack);
        slot.clear();
        
        this.movingSlot.update();
        slot.update();

        this.emit("pickupstack", slotIndex);
        this.emit("operation", slotIndex, InventoryInteractionType.PICK_UP_STACK);
        this.emit("update", this.movingSlot);
        this.emit("update", slot);
    }
    public splitStack(slotIndex: number): void {
        const slot = this.inventory.getSlot(slotIndex);
        console.log("split stack", slot.stack, this.movingSlot);
        
        if(slot.isEmpty()) throw new ReferenceError("Failed to split stack; target slot is empty");
        if(!this.movingSlot.isEmpty()) throw new ReferenceError("Failed to split stack; moving slot is not empty");

        const splitStack = slot.stack.takeProportion(0.5);
        this.movingSlot.setStack(splitStack);
        
        this.movingSlot.update();
        slot.update();

        this.emit("splitstack", slotIndex);
        this.emit("operation", slotIndex, InventoryInteractionType.SPLIT_STACK);
        this.emit("update", this.movingSlot);
        this.emit("update", slot);
    }
    public swapStack(slotIndex: number): void {
        const slot = this.inventory.getSlot(slotIndex);
        console.log("swap stack", slot.stack, this.movingSlot);
        
        if(slot.isEmpty()) throw new ReferenceError("Failed to swap stack; target slot is empty");
        if(this.movingSlot.isEmpty()) throw new ReferenceError("Failed to swap stack; moving slot is empty");
        
        const oldSlotStack = slot.stack.clone();
        slot.setStack(this.movingSlot.stack);
        this.movingSlot.setStack(oldSlotStack);

        this.movingSlot.update();
        slot.update();

        this.emit("swapstack", slotIndex);
        this.emit("operation", slotIndex, InventoryInteractionType.SWAP_STACK);
        this.emit("update", this.movingSlot);
        this.emit("update", slot);
    }
    public updateAllSlots() {
        this.emit("updateall");
    }
}