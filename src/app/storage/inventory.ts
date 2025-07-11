import { $enum } from "ts-enum-util";
import { BlockStateType } from "../block/blockStateType";
import { BinaryBuffer, BOOL, U16, U8 } from "../serialization/binaryBuffer";
import { Serializable } from "../serialization/serializable";
import { BaseRegistries } from "../synchronization/baseRegistries";
import { ItemStack } from "./item";
import { StorageInterface } from "./storageInterface";

export class Inventory extends Serializable {
    private registries: BaseRegistries;
    public slots: StorageSlot[] = new Array;
    public uuid: string = crypto.randomUUID();
    private openInterfaces: Set<WeakRef<StorageInterface>> = new Set;

    constructor(registries: BaseRegistries) {
        super();

        this.registries = registries;
    }

    public createInterface(movingSlot: StorageSlot): StorageInterface {
        const storageInterface = new StorageInterface(this, movingSlot);
        this.openInterfaces.add(new WeakRef(storageInterface));
        return storageInterface;
    }
    public getOpenInterfaces() {
        const list: StorageInterface[] = new Array;
        for(const ref of this.openInterfaces) {
            const storageInterface = ref.deref();
            if(storageInterface == null) {
                this.openInterfaces.delete(ref);
            } else {
                list.push(storageInterface);
            }
        }
        return list;
    }

    public setSize(size: number) {
        if(this.slots.length > size) {
            this.slots.splice(size);
        } else {
            const oldSlotCount = this.slots.length;
            for(let i = oldSlotCount; i < size; i++) {
                this.slots.push(new StorageSlot(this.registries));
            }
        }
    }
    public getSize() {
        return this.slots.length;
    }
    public getSlot(index: number) {
        return this.slots[index];
    }
    public getSlotIndex(slot: StorageSlot) {
        return this.slots.indexOf(slot);
    }

    public clear() {
        for(const slot of this.slots) {
            slot.clear();
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_u16(this.slots.length);
        for(const slot of this.slots) {
            slot.write(bin);
        }
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        const count = bin.read_u16();
        for(let i = 0; i < count; i++) {
            const slot = new StorageSlot(this.registries);
            slot.read(bin);
            this.slots.push(slot);
        }
    }
    public getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            U16 +
            this.slots.reduce((size, slot) => size + slot.getExpectedSize(), 0)
        );
    }
}

export enum StorageSlotType {
    INPUT, OUTPUT, STORAGE
}

export class StorageSlot extends Serializable {
    take(arg0: number) {
        throw new Error("Method not implemented.");
    }
    mergeForce(remainder: any) {
        throw new Error("Method not implemented.");
    }
    private registries: BaseRegistries;
    public stack: ItemStack = null;
    public type: StorageSlotType = StorageSlotType.STORAGE;
    amount: number;

    constructor(registries: BaseRegistries) {
        super();

        this.registries = registries;
    }
    public clear() {
        this.stack = null;
    }
    public set(state: BlockStateType, amount: number) {
        this.stack ??= new ItemStack(this.registries);
        this.stack.state = state;
        this.stack.amount = amount;
    }
    public isEmpty() {
        return this.stack == null;
    }
    public setStack(stack: ItemStack) {
        if(this.stack == null) {
            this.stack = stack.clone();
        } else {
            this.stack.copy(stack);
        }
    }
    public addStack(stack: ItemStack) {
        if(this.isEmpty()) {
            this.setStack(stack);
            return null;
        } else {
            return this.stack.mergeWithRemainder(stack);
        }
    }
    public update() {
        if(this.stack != null && this.stack.amount == 0) {
            this.stack = null;
        }
    }


    protected serialize(bin: BinaryBuffer): void {
        bin.write_u8(this.type);
        bin.write_boolean(this.isEmpty());
        if(this.stack != null) {
            this.stack.write(bin);
        }
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.type = $enum(StorageSlotType).asValueOrThrow(bin.read_u8());

        const isEmpty = bin.read_boolean();
        if(!isEmpty) {
            this.stack = new ItemStack(this.registries);
            this.stack.read(bin);
        }
    }
    public getExpectedSize(): number {
        return (
            U8 +
            BOOL +
            (
                this.isEmpty() ? 0 : this.stack.getExpectedSize()
            )
        );
    }
}