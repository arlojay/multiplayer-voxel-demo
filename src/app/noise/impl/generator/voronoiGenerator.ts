import { $enum } from "ts-enum-util";
import { map } from "../../../math";
import { NoiseGenerator } from "../../noiseGenerator";
import { registerNoiseNode } from "../../noiseLoader";
import { WhiteNoise } from "../../whiteNoise";

export enum VoronoiMode { CELL, DISTANCE, DISTANCE2, EDGE };

const stride = 1;

const vector2X = new Float32Array(36);
const vector2Y = new Float32Array(36);

for(let i = 0; i < 36; i++) {
    const a = map(i, 0, 36, Math.PI * 0.5, Math.PI * 1.5);
    vector2X[i] = Math.cos(a) * 0.5;
    vector2Y[i] = Math.sin(a) * 0.5;
}


const vector3X = new Float32Array(1296);
const vector3Y = new Float32Array(1296);
const vector3Z = new Float32Array(1296);

for(let i = 0; i < 1296; i++) {
    const x = map(i % 36, 0, 36, Math.PI * 0.5, Math.PI * 1.5);
    const y = map(Math.round(i / 36), 0, 36, Math.PI * 0.5, Math.PI * 1.5);

    vector3X[i] = Math.cos(x) * Math.cos(y) * 0.5;
    vector3Y[i] = Math.sin(y) * 0.5;
    vector3Z[i] = Math.sin(x) * Math.cos(y) * 0.5;
}


const vector4X = new Float32Array(46656);
const vector4Y = new Float32Array(46656);
const vector4Z = new Float32Array(46656);
const vector4W = new Float32Array(46656);

for (let i = 0; i < 46656; i++) {
    const x = map(i % 36, 0, 36, Math.PI * 0.5, Math.PI * 1.5);
    const y = map(Math.floor((i / 36) % 36), 0, 36, Math.PI * 0.5, Math.PI * 1.5);
    const z = map(Math.floor(i / (36 * 36)), 0, 36, Math.PI * 0.5, Math.PI * 1.5);

    vector4X[i] = Math.cos(x) * Math.cos(y) * Math.cos(z) * 0.5;
    vector4Y[i] = Math.sin(y) * Math.cos(z) * 0.5;
    vector4Z[i] = Math.sin(z) * Math.cos(x) * 0.5;
    vector4W[i] = Math.sin(x) * Math.sin(z) * Math.sin(y) * 0.5;
}


export class VoronoiGenerator extends NoiseGenerator {
    public mode: VoronoiMode;
    public randomness: number;
    public randomGenerator: WhiteNoise;

    public static register() {
        registerNoiseNode("voronoi", (data, loaderProps) => new VoronoiGenerator(
            loaderProps.seed, data.seed,
            data.randomness ?? 1, $enum(VoronoiMode).getValueOrDefault(data.mode?.toUpperCase(), VoronoiMode.CELL)
        ));
    }

    serialize() {
        return {
            type: "voronoi",
            seed: this.seedOffset,
            randomness: this.randomness,
            mode: $enum(VoronoiMode).getKeyOrThrow(this.mode)
        }
    }
    public constructor(seed: number, seedOffset: number, randomness: number, mode: VoronoiMode) {
        super(seed, seedOffset);
        
        this.mode = mode;
        this.randomness = randomness;

        super.setSeed(seed);
    }

    public sample1d(t: number): number {
        let closest = 100;
        let closestId = 0.5;
        let closest2 = closest;
        let it = Math.round(t);

        for(let vt = it - stride; vt <= it + stride; vt++) {
            let id = this.randomGenerator.noise1D(vt + 110.38907218937722);
            let pt = vt + this.randomGenerator.noise1D(id) * this.randomness;

            var d = (pt - t) * (pt - t);
            if(d < closest) {
                closest2 = closest;
                closest = d;
                closestId = id;
            } else if(d < closest2) {
                closest2 = d;
            }
        }


        if(this.mode == VoronoiMode.CELL) return closestId;
        if(this.mode == VoronoiMode.DISTANCE) return Math.sqrt(closest) * 2 - 1;
        if(this.mode == VoronoiMode.DISTANCE2) return Math.sqrt(closest2) * 2 - 1;
        if(this.mode == VoronoiMode.EDGE) return Math.sqrt(closest2 - closest) * 2 - 1;
    }

    public sample2d(x: number, y: number): number {
        let closest = 100;
        let closestId = 0.5;
        let closest2 = closest;
        let ix = Math.round(x);
        let iy = Math.round(y);

        for(let vx = ix - stride; vx <= ix + stride; vx++) {
            for(let vy = iy - stride; vy <= iy + stride; vy++) {
                let id = this.randomGenerator.noise2D(vx + 679.7003017998444, vy + 101.29766833328003);
                let a = Math.floor(id * 18 + 18);
                let px = vx + vector2X[a] * this.randomness;
                let py = vy + vector2Y[a] * this.randomness;

                var d = (px - x) * (px - x) + (py - y) * (py - y);
                if(d < closest) {
                    closest2 = closest;
                    closest = d;
                    closestId = id;
                } else if(d < closest2) {
                    closest2 = d;
                }
            }
        }

        if(this.mode == VoronoiMode.CELL) return closestId;
        if(this.mode == VoronoiMode.DISTANCE) return Math.sqrt(closest) * 2 - 1;
        if(this.mode == VoronoiMode.DISTANCE2) return Math.sqrt(closest2) * 2 - 1;
        if(this.mode == VoronoiMode.EDGE) return Math.sqrt(closest2 - closest) * 2 - 1;
    }

    public sample3d(x: number, y: number, z: number): number {
        let closest = 100;
        let closestId = 0.5;
        let closest2 = closest;
        let ix = Math.round(x);
        let iy = Math.round(y);
        let iz = Math.round(z);

        for(let vx = ix - stride; vx <= ix + stride; vx++) {
            for(let vy = iy - stride; vy <= iy + stride; vy++) {
                for(let vz = iz - stride; vz <= iz + stride; vz++) {
                    let id = this.randomGenerator.noise3D(vx + 370.8698605604355, vy + 394.583012342351, vz + 266.0448425753781);
                    let a = Math.floor(id * 648 + 648);
                    let px = vx + vector3X[a] * this.randomness;
                    let py = vy + vector3Y[a] * this.randomness;
                    let pz = vz + vector3Z[a] * this.randomness;

                    var d = (px - x) * (px - x) + (py - y) * (py - y) + (pz - z) * (pz - z);
                    if(d < closest) {
                        closest2 = closest;
                        closest = d;
                        closestId = id;
                    } else if(d < closest2) {
                        closest2 = d;
                    }
                }
            }
        }


        if(this.mode == VoronoiMode.CELL) return closestId;
        if(this.mode == VoronoiMode.DISTANCE) return Math.sqrt(closest) * 2 - 1;
        if(this.mode == VoronoiMode.DISTANCE2) return Math.sqrt(closest2) * 2 - 1;
        if(this.mode == VoronoiMode.EDGE) return Math.sqrt(closest2 - closest) * 2 - 1;
    }

    public sample4d(x: number, y: number, z: number, w: number): number {
        let closest = 100;
        let closestId = 0.5;
        let closest2 = closest;
        let ix = Math.round(x);
        let iy = Math.round(y);
        let iz = Math.round(z);
        let iw = Math.round(w);

        for(let vx = ix - stride; vx <= ix + stride; vx++) {
            for(let vy = iy - stride; vy <= iy + stride; vy++) {
                for(let vz = iz - stride; vz <= iz + stride; vz++) {
                    for(let vw = iw - stride; vw <= iw + stride; vw++) {
                        let id = this.randomGenerator.noise4D(vx + 475.51918929852224, vy + 559.6194540791413, vz + 537.5058052033661, vw + 670.3566393736775);
                        let a = Math.floor(id * 23328 + 23328);
                        let px = vx + vector4X[a] * this.randomness;
                        let py = vy + vector4Y[a] * this.randomness;
                        let pz = vz + vector4Z[a] * this.randomness;
                        let pw = vw + vector4W[a] * this.randomness;

                        var d = (px - x) * (px - x) + (py - y) * (py - y) + (pz - z) * (pz - z) + (pw - w) * (pw - w);
                        if(d < closest) {
                            closest2 = closest;
                            closest = d;
                            closestId = id;
                        } else if(d < closest2) {
                            closest2 = d;
                        }
                    }
                }
            }
        }


        if(this.mode == VoronoiMode.CELL) return closestId;
        if(this.mode == VoronoiMode.DISTANCE) return Math.sqrt(closest) * 2 - 1;
        if(this.mode == VoronoiMode.DISTANCE2) return Math.sqrt(closest2) * 2 - 1;
        if(this.mode == VoronoiMode.EDGE) return Math.sqrt(closest2 - closest) * 2 - 1;
    }


    protected onSetSeed(): void {
        this.randomGenerator = new WhiteNoise(this.seed);
    }
    
    asCopy(): VoronoiGenerator {
        return new VoronoiGenerator(
            this.baseSeed, this.seedOffset,
            this.randomness, this.mode
        );
    }
}