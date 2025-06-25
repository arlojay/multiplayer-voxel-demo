import { float32ToInt32Bits } from "../serialization/bitUtils";


export class WhiteNoise {
    private seed: number;

    constructor(seed?: number) {
        this.seed = seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }

    public setSeed(seed: number): void {
        this.seed = seed;
    }

    public noise1D(x: number): number {
        return this.nextFloat(this.seed + 31 * float32ToInt32Bits(x * 144.18998932043792));
    }

    public noise2D(x: number, y: number): number {
        x += this.nextFloat(float32ToInt32Bits(y * 76.56321283161424)) + this.seed;
        y += this.nextFloat(float32ToInt32Bits(x * 67.94462287263809)) + this.seed;
        return this.nextFloat(this.seed + 31 * float32ToInt32Bits(this.noise1D(x + y)));
    }

    public noise3D(x: number, y: number, z: number): number {
        x += this.nextFloat(float32ToInt32Bits(y * 129.99210012904155)) + this.seed;
        y += this.nextFloat(float32ToInt32Bits(z * 49.629598117599926)) + this.seed;
        z += this.nextFloat(float32ToInt32Bits(x * -41.893388431863514)) + this.seed;
        return this.nextFloat(this.seed + 31 * float32ToInt32Bits(this.noise2D(x + y, z) * 0x7FFFFFFF + float32ToInt32Bits(z + x + y)));
    }

    public noise4D(x: number, y: number, z: number, w: number): number {
        x += this.nextFloat(float32ToInt32Bits(y * 129.99210012904155)) + this.seed;
        y += this.nextFloat(float32ToInt32Bits(z * 49.629598117599926)) + this.seed;
        z += this.nextFloat(float32ToInt32Bits(x * -41.893388431863514)) + this.seed;
        w += this.nextFloat(float32ToInt32Bits(x * 467.3143869153039)) + this.seed;
        return this.nextFloat(this.seed + 31 * float32ToInt32Bits(this.noise3D(x + y + z, z + w, w) * 0x7FFFFFFF + float32ToInt32Bits(z + x + y + z)));
    }

    private nextFloat(seed: number): number {
        const randomValue = (seed % 0x7FFFFFFF) / 0x7FFFFFFF;
        return ((randomValue * Math.PI) * 0x7FFF) % 1;
    }
}