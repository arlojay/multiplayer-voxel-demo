import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";
import { OctaveNoiseSampler } from "../../octaveNoiseSampler";

export class OctaveNoise extends NoiseNode {
    private noise: NoiseNode;
    public detail: number;
    public roughness: number;
    public lacunarity: number;
    public distortion: number;
    
    static register() {
        registerNoiseNode("octave", (data, loaderProps) => {
            if(data.source == null) throw new ReferenceError("octave transformer must have a `source`");
            const source = loadNoiseNode(data.source, loaderProps);

            const detail = data.detail ?? 2;
            const roughness = data.roughness ?? 0.5;
            const lacunarity = data.lacunarity ?? 2;
            const distortion = data.distortion ?? 0;
            
            return new OctaveNoise(
                source,
                detail, roughness,
                lacunarity, distortion
            );
        });
    }

    public serialize() {
        return {
            type: "octave",
            detail: this.detail,
            roughness: this.roughness,
            lacunarity: this.lacunarity,
            distortion: this.distortion,
            source: this.noise.serialize()
        }
    }

    public constructor(noise: NoiseNode, detail: number, roughness: number, lacunarity: number, distortion: number) {
        super();
        this.noise = noise;
        this.detail = detail;
        this.roughness = roughness;
        this.lacunarity = lacunarity;
        this.distortion = distortion;
    }
    sample1d(t: number): number {
        return OctaveNoiseSampler.sample1d(this.noise, t, this.detail, this.roughness, this.lacunarity, this.distortion);
    }
    sample2d(x: number, y: number): number {
        return OctaveNoiseSampler.sample2d(this.noise, x, y, this.detail, this.roughness, this.lacunarity, this.distortion);
    }
    sample3d(x: number, y: number, z: number): number {
        return OctaveNoiseSampler.sample3d(this.noise, x, y, z, this.detail, this.roughness, this.lacunarity, this.distortion);
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        return OctaveNoiseSampler.sample4d(this.noise, x, y, z, w, this.detail, this.roughness, this.lacunarity, this.distortion);
    }
    setSeed(seed: number): void {
        this.noise.setSeed(seed);
    }
    asCopy(): OctaveNoise {
        return new OctaveNoise(this.noise.asCopy(), this.detail, this.roughness, this.lacunarity, this.distortion);
    }

    getSources(): NoiseNode[] {
        return [ this.noise ];
    }
}