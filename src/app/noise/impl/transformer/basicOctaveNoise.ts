import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";

export class BasicOctaveNoise extends NoiseNode {
    private noise: NoiseNode;
    public amplitudes: number[];
    
    static register() {
        registerNoiseNode("basic-octave", (data, loaderProps) => {
            if(data.source == null) throw new ReferenceError("basic-octave transformer must have a `source`");
            const source = loadNoiseNode(data.source, loaderProps);

            const amplitudes = data.amplitudes;
            if(amplitudes == null) throw new ReferenceError("basic-octave transformer must have `amplitudes`");
            if(!(amplitudes instanceof Array)) throw new TypeError("`amplitudes` must be an array");
            
            return new BasicOctaveNoise(
                source,
                amplitudes
            );
        });
    }

    public serialize() {
        return {
            type: "basic-octave",
            amplitudes: this.amplitudes,
            source: this.noise.serialize()
        }
    }

    public constructor(noise: NoiseNode, amplitudes: number[]) {
        super();
        this.noise = noise;
        this.amplitudes = amplitudes;
    }

    asCopy(): BasicOctaveNoise {
        return new BasicOctaveNoise(this.noise.asCopy(), Array.from(this.amplitudes));
    }


    sample1d(t: number): number {
        let max = 0;
        let value = 0;
        let effectiveness = 1;
        let scale = 1;
        let i = 0;
        for(const amplitude of this.amplitudes) {
            i++;
            max += effectiveness;
            if(amplitude != 0) value += this.noise.sample1d(
                t * scale + i * 170.74026176879897
            ) * effectiveness * amplitude;

            effectiveness *= 0.5;
            scale *= 2;
        }
        return value / max;
    }
    sample2d(x: number, y: number): number {
        let max = 0;
        let value = 0;
        let effectiveness = 1;
        let scale = 1;
        let i = 0;
        for(const amplitude of this.amplitudes) {
            i++;
            max += effectiveness;
            if(amplitude != 0) value += this.noise.sample2d(
                x * scale + i * 73.948990498798,
                y * scale + i * 785.6504844886496
            ) * effectiveness * amplitude;

            effectiveness *= 0.5;
            scale *= 2;
        }
        return value / max;
    }
    sample3d(x: number, y: number, z: number): number {
        let max = 0;
        let value = 0;
        let effectiveness = 1;
        let scale = 1;
        let i = 0;
        for(const amplitude of this.amplitudes) {
            i++;
            max += effectiveness;
            if(amplitude != 0) value += this.noise.sample3d(
                x * scale + i * 368.31313629154084,
                y * scale + i * 420.62485068161016,
                z * scale + i * 523.7760189663836
            ) * effectiveness * amplitude;

            effectiveness *= 0.5;
            scale *= 2;
        }
        return value / max;
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        let max = 0;
        let value = 0;
        let effectiveness = 1;
        let scale = 1;
        let i = 0;
        for(const amplitude of this.amplitudes) {
            i++;
            max += effectiveness;
            if(amplitude != 0) value += this.noise.sample4d(
                x * scale + i * 707.7451164777871,
                y * scale + i * 640.0279481315554,
                z * scale + i * 178.45669172182488,
                w * scale + i * 862.9621652014006
            ) * effectiveness * amplitude;

            effectiveness *= 0.5;
            scale *= 2;
        }
        return value / max;
    }
    setSeed(seed: number): void {
        this.noise.setSeed(seed);
    }

    getSources(): NoiseNode[] {
        return [ this.noise ];
    }
}