export function lerp(a: number, b: number, t: number) {
    return (b - a) * t + a;
}
export function dlerp(a: number, b: number, dt: number, speed: number) {
    return (b - a) * (1 - 0.5 ** (dt * speed)) + a;
}
export function clamp(v: number, min: number, max: number) {
    return Math.max(Math.min(v, max), min);
}
export function map(v: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) {
    return (v - inputMin) / (inputMax - inputMin) * (outputMax - outputMin) + outputMin;
}
export function equalsWithTolerance(a: number, b: number, tolerance: number) {
    return Math.abs(a - b) < tolerance;
}