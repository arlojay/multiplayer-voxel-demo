#include "lib/random.glsl"

uniform float time;

varying vec3 vPos;
varying vec3 vColor;
varying vec3 vLocalPos;

float manhattanDistance(vec3 a, vec3 b) {
    return (
        abs(a.x - b.x) +
        abs(a.y - b.y) +
        abs(a.z - b.z)
    );
}

vec3 extreme(vec3 v) {
    vec3 a = abs(v);
    return vec3(
        a.x >= a.y && a.x >= a.z ? v.x : 0.0,
        a.y >= a.x && a.y >= a.z ? v.y : 0.0,
        a.z >= a.x && a.z >= a.y ? v.z : 0.0
    );
}

float lum(vec3 c) {
    return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
}

void main() {
    vec3 localPosAdjusted = vLocalPos - vec3(0.5);
    vec3 adjustedExtreme = extreme(localPosAdjusted);
    vec3 normal = normalize(adjustedExtreme);
    vec3 preUv = localPosAdjusted - adjustedExtreme;
    vec2 uv = vec2(0.0);
    
    if(normal.x != 0.0) uv = preUv.zy;
    if(normal.y != 0.0) uv = preUv.xz;
    if(normal.z != 0.0) {
        uv = preUv.xy;
        uv.x *= -1.0;
    }


    float edgeFactor = 0.0;
    if(abs(uv.x) > 0.45) edgeFactor = 1.0;
    if(abs(uv.y) > 0.45) edgeFactor = 1.0;

    vec3 sunPos = vec3(
        0.3,
        1.0,
        0.6
    );

    float shadow = dot(normal, normalize(sunPos)) * 0.5 + 0.5;

    vec3 col = mix(vColor, vec3(lum(vColor) > 0.25 ? 0.0 : 0.5), edgeFactor * 0.5) * shadow;
    // vec3 col = preUv;
    gl_FragColor = vec4(col, 1.0);
}