import { NoiseGenerator } from "../../noiseGenerator";
import { registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";

export class ConstantValueGenerator extends NoiseGenerator {
    value: number;

    static register() {
        registerNoiseNode("const", (data, loaderProps) => new ConstantValueGenerator(
            data.value ?? 0
        ));
    }
    public serialize() {
        return {
            type: "const",
            value: this.value
        }
    }

    public constructor(value: number) {
        super(0, 0);
        this.value = value;
    }
    
    sample1d(t: number): number {
        return this.value;
    }
    sample2d(x: number, y: number): number {
        return this.value;
    }
    sample3d(x: number, y: number, z: number): number {
        return this.value;
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        return this.value;
    }

    onSetSeed(): void {
        
    }
    asCopy(): NoiseNode {
        return new ConstantValueGenerator(this.value);
    }
}