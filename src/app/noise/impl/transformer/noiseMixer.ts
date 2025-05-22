import { MultiInputNoiseTransformer } from "../../multiInputNoiseTransformer";
import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";

export interface MixerSource {
    factor: number;
    noise: NoiseNode;
}

export class NoiseMixer extends MultiInputNoiseTransformer {
    public noiseFactors: number[];
    public noiseFactorSum: number;
    public normalize: boolean;
    public mixerSources: MixerSource[];

    static register() {
        registerNoiseNode("mix", (data, loaderProps) => {
            if(data.sources == null) throw new ReferenceError("mix transformer must have a `sources` node array");

            const sources: Array<MixerSource> = new Array;
            for(const source of data.sources) {
                if(source.noise == null) throw new ReferenceError("mix transformer sources must have a `noise` source");
                sources.push({
                    factor: source.factor,
                    noise: loadNoiseNode(source.noise, loaderProps)
                });
            }

            const normalize = data.normalize ?? true;
            
            return new NoiseMixer(
                sources,
                normalize
            );
        });
    }

    public serialize() {
        return {
            type: "mix",
            sources: this.mixerSources.map(source => ({
                factor: source.factor,
                noise: source.noise.serialize()
            }))
        }
    }

    public constructor(sources: MixerSource[], normalize: boolean) {
        super(sources.map(v => v.noise));

        this.mixerSources = sources;
        this.normalize = normalize;
        this.noiseFactors = sources.map(v => v.factor);
        this.noiseFactorSum = this.noiseFactors.reduce((p, c) => p + c, 0);
    }

    transform(samples: number[]): number {
        let total = 0;
        for (let i = 0; i < this.sourceCount; i++) total += samples[i] * this.noiseFactors[i];

        return this.normalize ? total / this.noiseFactorSum : total;
    }
    asCopy(): NoiseMixer {
        return new NoiseMixer(
            this.mixerSources.map(v => ({
                factor: v.factor,
                noise: v.noise.asCopy()
            })),
            this.normalize
        );
    }
}