import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";

export class NoiseGradientTransformer extends NoiseNode {
    private noise: NoiseNode;
    private h: number;

    static register() {
        registerNoiseNode("gradient", (data, loaderProps) => {
            if(data.source == null) throw new ReferenceError("gradient transformer must have a `source`");
            const source = loadNoiseNode(data.source, loaderProps);
            
            const h = data.h ?? 0.001;
            
            return new NoiseGradientTransformer(source, h);
        });
    }

    public serialize() {
        return {
            type: "gradient",
            source: this.noise.serialize()
        }
    }

    public constructor(noise: NoiseNode, h: number = 0.001) {
        super();
        this.noise = noise;
        this.h = h;
    }

    public sample1d(t: number) {
        var deltaT = (this.noise.sample1d(t + this.h) - this.noise.sample1d(t - this.h)) / (this.h * 2);
        return Math.abs(deltaT);
    }

    public sample2d(x: number, y: number) {
        var deltaX = (this.noise.sample2d(x + this.h, y) - this.noise.sample2d(x - this.h, y)) / (this.h * 2);
        var deltaY = (this.noise.sample2d(x, y + this.h) - this.noise.sample2d(x, y - this.h)) / (this.h * 2);

        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    public sample3d(x: number, y: number, z: number) {
        var deltaX = (this.noise.sample3d(x + this.h, y, z) - this.noise.sample3d(x - this.h, y, z)) / (this.h * 2);
        var deltaY = (this.noise.sample3d(x, y + this.h, z) - this.noise.sample3d(x, y - this.h, z)) / (this.h * 2);
        var deltaZ = (this.noise.sample3d(x, y, z + this.h) - this.noise.sample3d(x, y, z - this.h)) / (this.h * 2);

        return Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
    }

    public sample4d(x: number, y: number, z: number, w: number) {
        var deltaX = (this.noise.sample4d(x + this.h, y, z, w) - this.noise.sample4d(x - this.h, y, z, w)) / (this.h * 2);
        var deltaY = (this.noise.sample4d(x, y + this.h, z, w) - this.noise.sample4d(x, y - this.h, z, w)) / (this.h * 2);
        var deltaZ = (this.noise.sample4d(x, y, z + this.h, w) - this.noise.sample4d(x, y, z - this.h, w)) / (this.h * 2);
        var deltaW = (this.noise.sample4d(x, y, z, w + this.h) - this.noise.sample4d(x, y, z, w - this.h)) / (this.h * 2);

        return Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ + deltaW * deltaW);
    }
    setSeed(seed: number): void {
        this.noise.setSeed(seed);
    }
    asCopy(): NoiseGradientTransformer {
        return new NoiseGradientTransformer(this.noise.asCopy());
    }
    getSources(): NoiseNode[] {
        return [ this.noise ];
    }
}