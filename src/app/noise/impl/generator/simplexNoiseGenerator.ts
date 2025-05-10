import alea from "alea";
import { createNoise2D, createNoise3D, createNoise4D, NoiseFunction2D, NoiseFunction3D, NoiseFunction4D } from "simplex-noise";
import { NoiseGenerator } from "../../noiseGenerator";
import { NoiseNode } from "../../noiseNode";
import { registerNoiseNode } from "../../noiseLoader";

export class SimplexNoiseGenerator extends NoiseGenerator {
    public noise2d: NoiseFunction2D;
    public noise3d: NoiseFunction3D;
    public noise4d: NoiseFunction4D;

    static register() {
        registerNoiseNode("simplex", (data, loaderProps) => new SimplexNoiseGenerator(
            loaderProps.seed,
            data.seed,
        ));
    }

    public serialize() {
        return {
            type: "simplex",
            seed: this.seedOffset
        }
    }

    public constructor(seed: number, seedOffset: number) {
        super(seed, seedOffset);
        super.setSeed(seed);
    }
    
    sample1d(t: number): number {
        return this.noise2d(t, 0);
    }
    sample2d(x: number, y: number): number {
        return this.noise2d(x, y);
    }
    sample3d(x: number, y: number, z: number): number {
        return this.noise3d(x, y, z);
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        return this.noise4d(x, y, z, w);
    }

    onSetSeed(): void {
        this.noise2d = createNoise2D(alea(this.seed));
        this.noise3d = createNoise3D(alea(this.seed));
        this.noise4d = createNoise4D(alea(this.seed));
    }
    asCopy(): NoiseNode {
        return new SimplexNoiseGenerator(this.baseSeed, this.seedOffset);
    }
}