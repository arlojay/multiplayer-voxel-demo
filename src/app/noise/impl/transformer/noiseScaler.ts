import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";

export class NoiseScaler extends NoiseNode {
    private noise: NoiseNode;
    public scaleX: number;
    public scaleY: number;
    public scaleZ: number;
    public scaleW: number;

    static register() {
        registerNoiseNode("scale", (data, loaderProps) => {
            if(data.source == null) throw new ReferenceError("scale transformer must have a `source`");
            const source = loadNoiseNode(data.source, loaderProps);
            
            const scalar = data.scalar ?? 1;
            const scaleX = data.scale_x ?? scalar;
            const scaleY = data.scale_y ?? scalar;
            const scaleZ = data.scale_z ?? scalar;
            const scaleW = data.scale_w ?? scalar;
            
            return new NoiseScaler(
                source,
                scaleX, scaleY, scaleZ, scaleW
            );
        });
    }

    public serialize() {
        return {
            type: "scale",
            scale_x: this.scaleX,
            scale_y: this.scaleY,
            scale_z: this.scaleZ,
            scale_w: this.scaleW,
            source: this.noise.serialize()
        }
    }

    public constructor(noise: NoiseNode, scaleX: number, scaleY: number, scaleZ: number, scaleW: number) {
        super();
        this.noise = noise;
        this.scaleX = scaleX;
        this.scaleY = scaleY;
        this.scaleZ = scaleZ;
        this.scaleW = scaleW;
    }
    sample1d(t: number): number {
        return this.noise.sample1d(t / this.scaleX);
    }
    sample2d(x: number, y: number): number {
        return this.noise.sample2d(x / this.scaleX, y / this.scaleY);
    }
    sample3d(x: number, y: number, z: number): number {
        return this.noise.sample3d(x / this.scaleX, y / this.scaleY, z / this.scaleZ);
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        return this.noise.sample4d(x / this.scaleX, y / this.scaleY, z / this.scaleZ, w / this.scaleW);
    }
    setSeed(seed: number): void {
        this.noise.setSeed(seed);
    }
    asCopy(): NoiseScaler {
        return new NoiseScaler(this.noise.asCopy(), this.scaleX, this.scaleY, this.scaleZ, this.scaleW);
    }

    getSources(): NoiseNode[] {
        return [ this.noise ];
    }
}