import alea from "alea";
import { NoiseGenerator } from "../../noiseGenerator";
import { NoiseNode } from "../../noiseNode";
import { registerNoiseNode } from "../../noiseLoader";
import { WhiteNoise } from "../../whiteNoise";

export class WhiteNoiseGenerator extends NoiseGenerator {
    noise: WhiteNoise;
    

    static register() {
        registerNoiseNode("noise", (data, loaderProps) => new WhiteNoiseGenerator(
            loaderProps.seed,
            data.seed,
        ));
    }

    public serialize() {
        return {
            type: "noise",
            seed: this.seedOffset
        }
    }

    public constructor(seed: number, seedOffset: number) {
        super(seed, seedOffset);

        super.setSeed(seed);
    }
    
    sample1d(t: number): number {
        return this.noise.noise1D(t);
    }
    sample2d(x: number, y: number): number {
        return this.noise.noise2D(x, y);
    }
    sample3d(x: number, y: number, z: number): number {
        return this.noise.noise3D(x, y, z);
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        return this.noise.noise4D(x, y, z, w);
    }

    onSetSeed(): void {
        this.noise = new WhiteNoise(this.seed);
    }
    asCopy(): NoiseNode {
        return new WhiteNoiseGenerator(this.baseSeed, this.seedOffset);
    }
}