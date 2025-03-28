import { color, float, Fn, mix, normalize, positionLocal, smoothstep } from "three/src/nodes/TSL";

export const skyColor = Fn(() => {
    const positionNormalized = normalize(positionLocal).toVar();
    return mix(color(0.2, 0.3, 0.4), color(0.6, 0.7, 0.8), smoothstep(float(-0.5), float(0.5), positionNormalized.y)).pow(float(2)).mul(float(1.5));
})