export function lerp(a: number, b: number, t: number) {
    return (b - a) * t + a;
}
export function dlerp(a: number, b: number, dt: number, speed: number) {
    return (b - a) * (1 - (1 / (speed + 1)) ** (dt)) + a;
}
export function vlerp(a: number, dt: number, velocity: number) {
    return a + velocity * dt;
}
export function alerp(a: number, dt: number, velocity: number, acceleration: number) {
    return a + velocity * dt + 0.5 * acceleration * dt * dt;
}
export function iteratedPositionLerp(dt: number, position: number, velocity: number, acceleration: number, dragCoefficient: number) {
    return positionLerp(dt, position, velocityLerp(dt, velocity, acceleration, dragCoefficient), acceleration, dragCoefficient);
}
export function positionLerp(dt: number, position: number, velocity: number, acceleration: number, dragCoefficient: number) {
    if (dragCoefficient === 0) return position + velocity * dt + 0.5 * acceleration * dt * dt;
    
    const exp = Math.exp(-dragCoefficient * dt);
    return position
        + (velocity / dragCoefficient) * (1 - exp)
        + (acceleration / (dragCoefficient * dragCoefficient)) * (1 - exp - dragCoefficient * dt * exp);
}
export function velocityLerp(dt: number, velocity: number, acceleration: number, dragCoefficient: number) {
    if (dragCoefficient === 0) return velocity + acceleration * dt;

    const exp = Math.exp(-dragCoefficient * dt);
    return velocity * exp + (acceleration / dragCoefficient) * (1 - exp);
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