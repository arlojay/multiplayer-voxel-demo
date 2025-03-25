import { Camera, PerspectiveCamera, Scene, ShaderMaterial, WebGLRenderer } from "three";
import { TypedEmitter } from "tiny-typed-emitter";
import { loadShaderProgram } from "./shaderHelper";
import { World } from "./world";
import { WorldRenderer } from "./worldRenderer";

interface GameRendererEvents {
    "frame": (time: number, dt: number) => void;
    "resize": () => void;
}

export class GameRenderer extends TypedEmitter<GameRendererEvents> {
    public world: World = null;
    public worldRenderer: WorldRenderer = null;

    public renderer: WebGLRenderer = null;
    public camera: Camera = new PerspectiveCamera(90, 1, 0.01, 3000);
    public scene: Scene = new Scene();

    private terrainShader: ShaderMaterial = null;
    private lastRenderTime: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        super();
        
        this.renderer = new WebGLRenderer({ canvas });
    }
    public async init() {
        this.resize();
        window.addEventListener("resize", () => this.resize());

        this.camera.position.set(16, 16, 16);

        this.terrainShader = await loadShaderProgram("assets/shaders/terrain", {
            time: { value: 0 }
        });
        
        requestAnimationFrame(time => this.render(time));
    }

    public render(time: number) {
        time /= 1000;
        const dt = (time - this.lastRenderTime);
        this.lastRenderTime = time;

        
        if(this.worldRenderer != null) {
            this.emit("frame", time, dt);
            this.worldRenderer.update(dt);

            this.terrainShader.uniforms.time.value = time;
            this.renderer.render(this.scene, this.camera);
        }

        requestAnimationFrame(time => this.render(time));
    }
    public resize() {
        this.renderer.setPixelRatio(devicePixelRatio);
        this.renderer.setSize(innerWidth, innerHeight);

        if(this.camera instanceof PerspectiveCamera) {
            this.camera.aspect = innerWidth / innerHeight;
            this.camera.updateProjectionMatrix();
        }

        this.emit("resize");
    }

    public setWorld(world: World) {
        if(this.world == world) return;

        this.world = world;
        this.worldRenderer = new WorldRenderer(this.world, this.scene, this.terrainShader);
    }
}