import { Copyable } from "./copyable";
import { ConstantValueGenerator } from "./impl/generator/constantValueGenerator";
import { MixerSource, NoiseMixer } from "./impl/transformer/noiseMixer";
import { NoiseOperation, OperationType } from "./impl/transformer/noiseOperation";
import { NoiseScaler } from "./impl/transformer/noiseScaler";

export abstract class NoiseNode implements Copyable<NoiseNode> {
    abstract asCopy(): NoiseNode;
    abstract sample1d(t: number): number;
    abstract sample2d(x: number, y: number): number;
    abstract sample3d(x: number, y: number, z: number): number;
    abstract sample4d(x: number, y: number, z: number, w: number): number;

    abstract setSeed(seed: number): void;
    abstract serialize(): any;

    abstract getSources(): NoiseNode[];

    public scale(scaleX: number, scaleY = scaleX, scaleZ = scaleY, scaleW = scaleZ) {
        return new NoiseScaler(this, scaleX, scaleY, scaleZ, scaleW);
    }
    public add(...values: (NoiseNode | number)[]): NoiseNode {
        if(values.length == 1) {
            return new NoiseOperation(this, this.node(values[0]), OperationType.ADD);
        } else {
            const sources: MixerSource[] = new Array;
            sources.push({
                factor: 1,
                noise: this
            });
            for(const value of values) {
                sources.push({
                    factor: 1,
                    noise: this.node(value)
                })
            }
            return new NoiseMixer(sources, false);
        }
    }
    public sub(...values: (NoiseNode | number)[]): NoiseNode {
        if(values.length == 1) {
            return new NoiseOperation(this, this.node(values[0]), OperationType.SUBTRACT);
        } else {
            const sources: MixerSource[] = new Array;
            sources.push({
                factor: 1,
                noise: this
            });
            for(const value of values) {
                sources.push({
                    factor: -1,
                    noise: this.node(value)
                })
            }
            return new NoiseMixer(sources, false);
        }
    }
    public mul(...values: (NoiseNode | number)[]): NoiseNode {
        let currentNode: NoiseNode = this;
        for(const value of values) {
            currentNode = new NoiseOperation(currentNode, this.node(value), OperationType.MULTIPLY);
        }
        return currentNode;
    }
    public div(...values: (NoiseNode | number)[]): NoiseNode {
        let currentNode: NoiseNode = this;
        for(const value of values) {
            currentNode = new NoiseOperation(currentNode, this.node(value), OperationType.DIVIDE);
        }
        return currentNode;
    }
    public pow(...values: (NoiseNode | number)[]): NoiseNode {
        let currentNode: NoiseNode = this;
        for(const value of values) {
            currentNode = new NoiseOperation(currentNode, this.node(value), OperationType.POWER);
        }
        return currentNode;
    }

    private node(value: NoiseNode | number): NoiseNode {
        if(typeof value == "number") value = new ConstantValueGenerator(value);
        return value;
    }
}