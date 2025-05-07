import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";
import { SingleInputNoiseTransformer } from "../../singleInputNoiseTransformer";

export class NoiseMapper extends SingleInputNoiseTransformer {
    public inputMin: number;
    public inputMax: number;
    public outputMin: number;
    public outputMax: number;

    static register() {
        registerNoiseNode("map", (data, loaderProps) => {
            if(data.source == null) throw new ReferenceError("map transformer must have a `source`");
            const source = loadNoiseNode(data.source, loaderProps);

            const inputMin = data.inputMin ?? -1;
            const inputMax = data.inputMax ?? 1;
            const outputMin = data.outputMin ?? -1;
            const outputMax = data.outputMax ?? 1;
            
            return new NoiseMapper(
                source,
                inputMin, inputMax,
                outputMin, outputMax
            );
        });
    }

    public serialize() {
        return {
            type: "map",
            inputMin: this.inputMin,
            inputMax: this.inputMax,
            outputMin: this.outputMin,
            outputMax: this.outputMax,
            source: this.source.serialize()
        }
    }

    public constructor(source: NoiseNode, inputMin: number, inputMax: number, outputMin: number, outputMax: number) {
        super(source);

        this.inputMin = inputMin;
        this.inputMax = inputMax;
        this.outputMin = outputMin;
        this.outputMax = outputMax;
    }
    protected transform(v: number): number {
        return (v - this.inputMin) / (this.inputMax - this.inputMin) * (this.outputMax - this.outputMin) + this.outputMin;
    }
    asCopy(): SingleInputNoiseTransformer {
        return new NoiseMapper(this.source.asCopy(), this.inputMin, this.inputMax, this.outputMin, this.outputMax);
    }
}