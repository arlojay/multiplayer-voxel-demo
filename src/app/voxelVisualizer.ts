import { Camera, PerspectiveCamera, Scene, ShaderMaterial, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadShaderProgram } from "./shaderHelper";
import { World } from "./world";
import { WorldRenderer } from "./worldRenderer";

export class VoxelVisualizer {
    public world: World = null;
    public worldRenderer: WorldRenderer = null;
    public renderer: WebGLRenderer = null;
    public camera: Camera = new PerspectiveCamera(90, 1, 0.01, 3000);
    public scene: Scene = new Scene();
    public controls: OrbitControls = null;

    private canvas: HTMLCanvasElement = null;
    private terrainShader: ShaderMaterial = null;
    private lastRenderTime: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        
        this.renderer = new WebGLRenderer({ canvas });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    }

    render(time: number) {
        time /= 1000;
        const dt = (time - this.lastRenderTime);
        this.lastRenderTime = time;

        
        this.controls.update(dt);
        this.worldRenderer.update(dt);

        this.terrainShader.uniforms.time.value = time;

        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(time => this.render(time));
    }
    resize() {
        this.renderer.setPixelRatio(devicePixelRatio);
        this.renderer.setSize(innerWidth, innerHeight);

        if(this.camera instanceof PerspectiveCamera) {
            this.camera.aspect = innerWidth / innerHeight;
            this.camera.updateProjectionMatrix();
        }
    }
    async init() {
        this.resize();
        window.addEventListener("resize", () => this.resize());

        this.camera.position.set(16, 16, 16);
        this.controls.update();

        this.terrainShader = await loadShaderProgram("assets/shaders/terrain", {
            time: { value: 0 }
        });
        this.world = new World();
        this.worldRenderer = new WorldRenderer(this.world, this.scene, this.terrainShader);
        
        requestAnimationFrame(time => this.render(time));
    }
}