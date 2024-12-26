float lerp(float a, float b, float t) {
    return (b - a) * clamp(t, 0.0, 1.0) + a;
}

vec2 lerp(vec2 a, vec2 b, float t) {
    return vec2(
        lerp(a.x, b.x, t),
        lerp(a.y, b.y, t)
    );
}

vec2 lerp(vec2 a, vec2 b, vec2 t) {
    return vec2(
        lerp(a.x, b.x, t.x),
        lerp(a.y, b.y, t.y)
    );
}

vec3 lerp(vec3 a, vec3 b, float t) {
    return vec3(
        lerp(a.x, b.x, t),
        lerp(a.y, b.y, t),
        lerp(a.z, b.z, t)
    );
}

vec3 lerp(vec3 a, vec3 b, vec3 t) {
    return vec3(
        lerp(a.x, b.x, t.x),
        lerp(a.y, b.y, t.y),
        lerp(a.z, b.z, t.z)
    );
}

vec4 lerp(vec4 a, vec4 b, float t) {
    return vec4(
        lerp(a.x, b.x, t),
        lerp(a.y, b.y, t),
        lerp(a.z, b.z, t),
        lerp(a.w, b.w, t)
    );
}

vec4 lerp(vec4 a, vec4 b, vec4 t) {
    return vec4(
        lerp(a.x, b.x, t.x),
        lerp(a.y, b.y, t.y),
        lerp(a.z, b.z, t.z),
        lerp(a.w, b.w, t.w)
    );
}