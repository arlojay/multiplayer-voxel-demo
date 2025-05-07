import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";
import { OctaveNoiseSampler } from "../../octaveNoiseSampler";

export class ErodedNoise implements NoiseNode {
    private noise: NoiseNode;
    public detail: number;
    public depth: number;
    public lacunarity: number;
    public stride: number;
    public roughness: number;
    public distortion: number;
    
    static register() {
        registerNoiseNode("erosion", (data, loaderProps) => {
            if(data.source == null) throw new ReferenceError("erosion transformer must have a `source`");
            const source = loadNoiseNode(data.source, loaderProps);

            const detail = data.detail ?? 2;
            const depth = data.depth ?? 2;
            const lacunarity = data.lacunarity ?? 2;
            const stride = data.stride ?? 2;
            const roughness = data.roughness ?? 2;
            const distortion = data.distortion ?? 2;
            
            return new ErodedNoise(
                source,
                detail, depth,
                lacunarity, stride,
                roughness, distortion
            );
        });
    }

    public serialize() {
        return {
            type: "basic-octave",
            detail: this.detail,
            depth: this.depth,
            lacunarity: this.lacunarity,
            stride: this.stride,
            roughness: this.roughness,
            distortion: this.distortion,
            source: this.noise.serialize()
        }
    }

    public constructor(noise: NoiseNode, detail: number, depth: number, lacunarity: number, stride: number, roughness: number, distortion: number) {
        this.noise = noise;
        this.detail = detail;
        this.depth = depth;
        this.lacunarity = lacunarity;
        this.stride = stride;
        this.roughness = roughness;
        this.distortion = distortion;
    }
    asCopy(): ErodedNoise {
        return new ErodedNoise(this.noise, this.detail, this.depth, this.lacunarity, this.stride, this.roughness, this.distortion);
    }

    sample1d(t: number): number {
        let max = 0.0;
        let value = 0.0;
        let effectiveness = 1.0;
        let scale = 1.0;
        let lacunarity = this.lacunarity;
    
        for (let i = 0; i < this.depth; i++) {
            const sample = Math.pow(
                Math.abs(
                    OctaveNoiseSampler.sample1d(
                        this.noise,
                        t * scale + i * 170.74026176879897,
                        this.detail,
                        this.roughness,
                        lacunarity,
                        this.distortion
                    )
                ) * 2.0 - 1.0,
                0.5
            );
    
            max += effectiveness;
            value += sample * effectiveness;
            scale *= this.stride;
    
            effectiveness *= this.roughness;
            lacunarity *= 0.75 * sample + 1.25;
        }
    
        return value / max;
    }
    
    sample2d(x: number, y: number): number {
        let max = 0.0;
        let value = 0.0;
        let effectiveness = 1.0;
        let scale = 1.0;
        let lacunarity = this.lacunarity;
    
        for (let i = 0; i < this.depth; i++) {
            const sample = Math.abs(OctaveNoiseSampler.sample2d(
                    this.noise,
                    x * scale + i * 73.948990498798,
                    y * scale + i * 785.6504844886496,
                    this.detail,
                    this.roughness,
                    lacunarity,
                    this.distortion
                )) * 2.0 - 1.0;
    
            max += effectiveness;
            value += sample * effectiveness;
            scale *= this.stride;
    
            effectiveness *= this.roughness;
            lacunarity *= 0.75 * sample + 1.25;
        }
    
        return value / max;
    }
    sample3d(x: number, y: number, z: number): number {
        let max = 0.0;
        let value = 0.0;
        let effectiveness = 1.0;
        let scale = 1.0;
        let lacunarity = this.lacunarity;
    
        for (let i = 0; i < this.depth; i++) {
            const sample = Math.abs(OctaveNoiseSampler.sample3d(
                    this.noise,
                    x * scale + i * 368.31313629154084,
                    y * scale + i * 420.62485068161016,
                    z * scale + i * 523.7760189663836,
                    this.detail,
                    this.roughness,
                    lacunarity,
                    this.distortion
                )) * 2.0 - 1.0;
    
            max += effectiveness;
            value += sample * effectiveness;
            scale *= this.stride;
    
            effectiveness *= this.roughness;
            lacunarity *= 0.75 * sample + 1.25;
        }
    
        return value / max;
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        let max = 0.0;
        let value = 0.0;
        let effectiveness = 1.0;
        let scale = 1.0;
        let lacunarity = this.lacunarity;
    
        for (let i = 0; i < this.depth; i++) {
            const sample = Math.abs(OctaveNoiseSampler.sample4d(
                    this.noise,
                    x * scale + i * 707.7451164777871,
                    y * scale + i * 640.0279481315554,
                    z * scale + i * 178.45669172182488,
                    w * scale + i * 862.9621652014006,
                    this.detail,
                    this.roughness,
                    lacunarity,
                    this.distortion
                )) * 2.0 - 1.0;
    
            max += effectiveness;
            value += sample * effectiveness;
            scale *= this.stride;
    
            effectiveness *= this.roughness;
            lacunarity *= 0.75 * sample + 1.25;
        }
    
        return value / max;
    }
    setSeed(seed: number): void {
        throw new Error("Method not implemented.");
    }

    getSources(): NoiseNode[] {
        return [ this.noise ];
    }
}