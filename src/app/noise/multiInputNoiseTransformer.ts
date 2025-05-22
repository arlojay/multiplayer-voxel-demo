import { NoiseNode } from "./noiseNode";

export abstract class MultiInputNoiseTransformer extends NoiseNode {
    protected sources: NoiseNode[];
    protected sourceCount: number;
    private samples: any[];

    public constructor(sources: NoiseNode[]) {
        super();
        this.sources = sources;
        this.sourceCount = sources.length;
        this.samples = new Array(this.sourceCount);
    }
    sample1d(t: number): number {
        for(let i = 0; i < this.sourceCount; i++) this.samples[i] = this.sources[i].sample1d(t);
        return this.transform(this.samples);
    }
    sample2d(x: number, y: number): number {
        for(let i = 0; i < this.sourceCount; i++) this.samples[i] = this.sources[i].sample2d(x, y);
        return this.transform(this.samples);
    }
    sample3d(x: number, y: number, z: number): number {
        for(let i = 0; i < this.sourceCount; i++) this.samples[i] = this.sources[i].sample3d(x, y, z);
        return this.transform(this.samples);
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        for(let i = 0; i < this.sourceCount; i++) this.samples[i] = this.sources[i].sample4d(x, y, z, w);
        return this.transform(this.samples);
    }
    setSeed(seed: number): void {
        for(const source of this.sources) source.setSeed(seed);
    }

    abstract transform(samples: number[]): number;
    abstract asCopy(): MultiInputNoiseTransformer;
    abstract serialize(): any;

    public getSources() {
        return Array.from(this.sources);
    }
}