import { NoiseNode } from "./noiseNode";

export abstract class NoiseGenerator implements NoiseNode {
    public seed: number;
    public baseSeed: number;
    public seedOffset: number;

    abstract sample1d(t: number): number;
    abstract sample2d(x: number, y: number): number;
    abstract sample3d(x: number, y: number, z: number): number;
    abstract sample4d(x: number, y: number, z: number, w: number): number;
    
    public constructor(seed: number, seedOffset?: number) {
        this.seedOffset = seedOffset ?? 0;
        this.setSeed(seed);
    }

    protected abstract onSetSeed(): void;
    
    setSeed(seed: number): void {
        this.baseSeed = seed;
        this.seed = seed + this.seedOffset;

        this.onSetSeed();
    }
    
    abstract asCopy(): NoiseNode;
    abstract serialize(): any;

    public getSources() {
        return new Array<NoiseNode>;
    }
}