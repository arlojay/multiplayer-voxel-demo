import { BlockStateSaveKey } from "../block/blockState";
import { BlockStateType } from "../block/blockStateType";
import { BinaryBuffer, U16 } from "../serialization/binaryBuffer";
import { Serializable } from "../serialization/serializable";
import { BaseRegistries } from "../synchronization/baseRegistries";

const STACK_SIZE = 64;

export class ItemStack extends Serializable {
    private registries: BaseRegistries;

    public state: BlockStateType;
    public amount: number;

    constructor(registries: BaseRegistries, state?: BlockStateType, amount?: number) {
        super();

        this.registries = registries;
        this.state = state ?? registries.blocks.getStateType("air#default");
        this.amount = amount ?? 1;
    }
    public mergeForce(other: ItemStack) {
        this.amount += other.amount;
    }
    public mergeWithRemainder(other: ItemStack) {
        if(other == null) return null;
        if(other.state.saveKey != this.state.saveKey) return other;

        const leeway = STACK_SIZE - this.amount;
        const operable = Math.min(leeway, other.amount);
        other.amount -= operable;
        this.amount += operable;

        return other;
    }
    public takeProportion(proportion: number) {
        return this.take(Math.ceil(this.amount * proportion));
    }
    public take(amount: number) {
        const taken = Math.min(this.amount, amount);
        this.amount -= taken;

        const newStack = this.clone();
        newStack.amount = taken;
        return newStack;
    }
    public clone() {
        return new ItemStack(this.registries, this.state, this.amount);
    }
    public copy(other: ItemStack) {
        this.amount = other.amount;
        this.state = other.state;
    }
    public isSameType(other: ItemStack) {
        if(other == null || other.amount == 0) return this.amount == 0;
        return other.state == this.state;
    }
    public equals(other: ItemStack) {
        return other.state == this.state && other.amount == this.amount;
    }
    
    protected serialize(bin: BinaryBuffer): void {
        bin.write_u16(this.amount);
        bin.write_string(this.state.saveKey);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.amount = bin.read_u16();
        this.state = this.registries.blocks.getStateType(bin.read_string() as BlockStateSaveKey);
    }
    public getExpectedSize(): number {
        return U16 + BinaryBuffer.stringByteCount(this.state.saveKey);
    }
}