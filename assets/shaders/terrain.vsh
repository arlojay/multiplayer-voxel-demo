uniform float time;

attribute vec3 color;
attribute vec3 localPos;

varying vec3 vPos;
varying vec3 vColor;
varying vec3 vLocalPos;

void main() {
    vColor = color;
    vLocalPos = localPos;

    vec4 relativeViewMatrix = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * relativeViewMatrix;

    vPos = position;
}