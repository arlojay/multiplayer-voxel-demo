import { NoiseNode } from "./noiseNode";

export abstract class SingleInputNoiseTransformer implements NoiseNode {
    protected source: NoiseNode;

    public constructor(source: NoiseNode) {
        this.source = source;
    }
    sample1d(t: number): number {
        return this.transform(this.source.sample1d(t));
    }
    sample2d(x: number, y: number): number {
        return this.transform(this.source.sample2d(x, y));
    }
    sample3d(x: number, y: number, z: number): number {
        return this.transform(this.source.sample3d(x, y, z));
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        return this.transform(this.source.sample4d(x, y, z, w));
    }
    protected abstract transform(v: number): number;
    setSeed(seed: number): void {
        this.source.setSeed(seed);
    }
    abstract asCopy(): SingleInputNoiseTransformer;
    abstract serialize(): any;

    public getSources() {
        return [ this.source ];
    }
}