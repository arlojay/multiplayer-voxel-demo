import { PerspectiveCamera, Scene, WebGLRenderer } from "three";

const renderer = new WebGLRenderer({ canvas: document.querySelector("canvas") });
const camera = new PerspectiveCamera(90, 1, 0.01, 3000);
const scene = new Scene();



init();


function render() {
    renderer.render(scene, camera);

    requestAnimationFrame(render);
}
function resize() {
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
}
function init() {
    resize();
    window.addEventListener("resize", resize);

    requestAnimationFrame(render);
}