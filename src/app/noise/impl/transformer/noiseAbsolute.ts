import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { SingleInputNoiseTransformer } from "../../singleInputNoiseTransformer";

export class NoiseAbsolute extends SingleInputNoiseTransformer {
    static register() {
        registerNoiseNode("absolute", (data, loaderProps) => {
            if(data.source == null) throw new ReferenceError("absolute transformer must have a `source`");
            const source = loadNoiseNode(data.source, loaderProps);
            
            return new NoiseAbsolute(source);
        });
    }

    public serialize() {
        return {
            type: "absolute",
            source: this.source.serialize()
        }
    }
    protected transform(v: number): number {
        return Math.abs(v);
    }
    asCopy(): NoiseAbsolute {
        return new NoiseAbsolute(this.source.asCopy());
    }
}