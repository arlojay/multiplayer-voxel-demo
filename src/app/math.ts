export function lerp(a: number, b: number, t: number) {
    return (b - a) * t + a;
}
export function dlerp(a: number, b: number, dt: number, speed: number) {
    return (b - a) * (1 - 0.5 ** (dt * speed)) + a;
}
export function clamp(v: number, min: number, max: number) {
    return Math.max(Math.min(v, max), min);
}