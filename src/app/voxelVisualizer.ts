import { PerspectiveCamera, Scene, ShaderMaterial, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadShaderProgram } from "./shaderHelper";
import { World } from "./world";

export class VoxelVisualizer {
    public world: World;
    public renderer: WebGLRenderer;
    public camera: PerspectiveCamera;
    public scene: Scene;
    public controls: OrbitControls;

    private canvas: HTMLCanvasElement;
    private terrainShader: ShaderMaterial;
    private lastRenderTime: number;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        

        this.renderer = new WebGLRenderer({ canvas });
        this.camera = new PerspectiveCamera(90, 1, 0.01, 3000);
        this.scene = new Scene();

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.terrainShader = null;
        this.world = null;
    }

    render(time: number) {
        time /= 1000;
        const dt = (time - this.lastRenderTime);
        this.lastRenderTime = time;

        
        this.controls.update(dt);
        this.world.update(dt);

        this.terrainShader.uniforms.time.value = time;

        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(time => this.render(time));
    }
    resize() {
        this.renderer.setPixelRatio(devicePixelRatio);
        this.renderer.setSize(innerWidth, innerHeight);
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
    }
    async init() {
        this.resize();
        window.addEventListener("resize", () => this.resize());

        this.camera.position.set(16, 16, 16);
        this.controls.update();

        this.terrainShader = await loadShaderProgram("assets/shaders/terrain", {
            time: { value: 0 }
        });
        this.world = new World(this.scene, this.terrainShader);
        
        requestAnimationFrame(time => this.render(time));
    }
}