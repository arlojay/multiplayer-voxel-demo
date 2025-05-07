import { Copyable } from "./copyable";

export interface NoiseNode extends Copyable<NoiseNode> {
    sample1d(t: number): number;
    sample2d(x: number, y: number): number;
    sample3d(x: number, y: number, z: number): number;
    sample4d(x: number, y: number, z: number, w: number): number;

    setSeed(seed: number): void;
    serialize(): any;

    getSources(): NoiseNode[];
}