import { NoiseNode } from "./noiseNode";

export class OctaveNoiseSampler {
    static sample1d(noise: NoiseNode, t: number, detail: number, roughness: number, lacunarity: number, distortion: number): number {
        if (distortion !== 0.0) {
            t += noise.sample1d(t + 79.70650251998678) * distortion;
        }

        let max = 0.0;
        let value = 0.0;
        let effectiveness = 1.0;
        let scale = 1.0;

        for (let i = 0; i < detail; i++) {
            max += effectiveness;
            value += noise.sample1d(
                t * scale + i * 170.74026176879897
            ) * effectiveness;

            effectiveness *= roughness;
            scale *= lacunarity;
        }

        return value / max;
    }

    static sample2d(noise: NoiseNode, x: number, y: number, detail: number, roughness: number, lacunarity: number, distortion: number): number {
        if (distortion !== 0.0) {
            x += noise.sample2d(x + 187.3475077705784, y + 304.7182892045774) * distortion;
            y += noise.sample2d(x + 574.7741054326257, y + 727.5476841481425) * distortion;
        }

        let max = 0.0;
        let value = 0.0;
        let effectiveness = 1.0;
        let scale = 1.0;

        for (let i = 0; i < detail; i++) {
            max += effectiveness;
            value += noise.sample2d(
                x * scale + i * 73.948990498798,
                y * scale + i * 785.6504844886496
            ) * effectiveness;

            effectiveness *= roughness;
            scale *= lacunarity;
        }

        return value / max;
    }

    static sample3d(noise: NoiseNode, x: number, y: number, z: number, detail: number, roughness: number, lacunarity: number, distortion: number): number {
        if (distortion !== 0.0) {
            x += noise.sample3d(x + 720.7530757031899, y + 630.0809779460403, z + 562.8202719963649) * distortion;
            y += noise.sample3d(x + 807.2943561962902, y + 956.9505378437133, z + 469.0741515073502) * distortion;
            z += noise.sample3d(x + 190.9268231977717, y + 773.6563178336033, z + 620.4209881004765) * distortion;
        }

        let max = 0.0;
        let value = 0.0;
        let effectiveness = 1.0;
        let scale = 1.0;

        for (let i = 0; i < detail; i++) {
            max += effectiveness;
            value += noise.sample3d(
                x * scale + i * 368.31313629154084,
                y * scale + i * 420.62485068161016,
                z * scale + i * 523.7760189663836
            ) * effectiveness;

            effectiveness *= roughness;
            scale *= lacunarity;
        }

        return value / max;
    }

    static sample4d(noise: NoiseNode, x: number, y: number, z: number, w: number, detail: number, roughness: number, lacunarity: number, distortion: number): number {
        if (distortion !== 0.0) {
            x += noise.sample4d(x + 840.5710651524474, y + 279.9952781849746, z + 459.5819482923276, w + 470.0537129999991) * distortion;
            y += noise.sample4d(x + 284.7644906307658, y + 578.7510039941111, z + 715.3533319641978, w + 489.6809640118021) * distortion;
            z += noise.sample4d(x + 687.2412190545887, y + 840.1166221979693, z + 574.3024728786922, w + 487.7604928342420) * distortion;
            w += noise.sample4d(x + 262.2764875080167, y + 423.4805327468889, z + 738.4261606156668, w + 295.5659973309972) * distortion;
        }

        let max = 0.0;
        let value = 0.0;
        let effectiveness = 1.0;
        let scale = 1.0;

        for (let i = 0; i < detail; i++) {
            max += effectiveness;
            value += noise.sample4d(
                x * scale + i * 707.7451164777871,
                y * scale + i * 640.0279481315554,
                z * scale + i * 178.45669172182488,
                w * scale + i * 862.9621652014006
            ) * effectiveness;

            effectiveness *= roughness;
            scale *= lacunarity;
        }

        return value / max;
    }
}
