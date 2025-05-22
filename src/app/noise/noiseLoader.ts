import { SimplexNoiseGenerator } from "./impl/generator/simplexNoiseGenerator";
import { BasicOctaveNoise } from "./impl/transformer/basicOctaveNoise";
import { ErodedNoise } from "./impl/transformer/erodedNoise";
import { NoiseAbsolute } from "./impl/transformer/noiseAbsolute";
import { NoiseMapper } from "./impl/transformer/noiseMapper";
import { NoiseMixer } from "./impl/transformer/noiseMixer";
import { NoiseOperation } from "./impl/transformer/noiseOperation";
import { NoiseScaler } from "./impl/transformer/noiseScaler";
import { NoiseSpline } from "./impl/transformer/noiseSpline";
import { OctaveNoise } from "./impl/transformer/octaveNoise";
import { NoiseNode } from "./noiseNode";

export class RefNode extends NoiseNode {
    public file: string;
    public constructor(file: string) {
        super();
        this.file = file;
    }

    sample1d(t: number): number {
        throw new Error("Method not implemented.");
    }
    sample2d(x: number, y: number): number {
        throw new Error("Method not implemented.");
    }
    sample3d(x: number, y: number, z: number): number {
        throw new Error("Method not implemented.");
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        throw new Error("Method not implemented.");
    }
    setSeed(seed: number): void {
        throw new Error("Method not implemented.");
    }

    serialize() {
        return {
            type: "ref",
            file: this.file
        };
    }
    getSources(): NoiseNode[] {
        return [];
    }
    asCopy(): NoiseNode {
        return new RefNode(this.file);
    }
}
export interface LoaderProperties {
    seed: number;
}
type NoiseNodeFactory = (data: any, loaderProps: LoaderProperties) => NoiseNode;

const factories: Map<string, NoiseNodeFactory> = new Map;

export function registerNoiseNode(id: string, factory: NoiseNodeFactory) {
    if(factories.has(id)) throw new ReferenceError("Node with id " + id + " is already registered");
    factories.set(id, factory);
}

export function loadNoiseNode(data: any, loaderProps: LoaderProperties): NoiseNode {
    if(data == null) throw new ReferenceError("Noise node is null");
    if(!("type" in data)) throw new ReferenceError("Field `type` must exist on all noise nodes");
    if(typeof data.type != "string") throw new TypeError("Field `type` must be a string");

    if(data.type == "ref") {
        return new RefNode(data.file);
    }
    const nodeFactory = factories.get(data.type);
    if(nodeFactory == null) throw new ReferenceError("Cannot find node type " + data.type);

    return nodeFactory(data, loaderProps);
}

export function registerDefaultNoiseNodes() {
    ErodedNoise.register();
    NoiseMapper.register();
    NoiseMixer.register();
    NoiseScaler.register();
    NoiseSpline.register();
    OctaveNoise.register();
    SimplexNoiseGenerator.register();
    NoiseAbsolute.register();
    NoiseOperation.register();
    BasicOctaveNoise.register();
}