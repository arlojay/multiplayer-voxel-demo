import { BoxGeometry, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, Scene, WebGPURenderer } from "three/src/Three.WebGPU";
import { TypedEmitter } from "tiny-typed-emitter";
import { World } from "./world";
import { WorldRenderer } from "./worldRenderer";
import { terrainColor } from "./shaders/terrain";
import { skyColor } from "./shaders/sky";
import { UIContainer } from "./ui";

interface GameRendererEvents {
    "frame": (time: number, dt: number) => void;
    "resize": () => void;
}

export class GameRenderer extends TypedEmitter<GameRendererEvents> {
    public world: World = null;
    public worldRenderer: WorldRenderer = null;

    public canvas: HTMLCanvasElement;
    public UIRoot: HTMLDivElement;
    public showingUIs: Set<UIContainer> = new Set;
    public renderer: WebGPURenderer = null;
    public camera: PerspectiveCamera = new PerspectiveCamera(90, 1, 0.01, 3000);
    public scene: Scene = new Scene();
    public skybox: Scene = new Scene();

    private terrainShader: MeshBasicNodeMaterial = null;
    private lastRenderTime: number = 0;

    constructor(canvas: HTMLCanvasElement, UIRoot: HTMLDivElement) {
        super();
        
        this.canvas = canvas;
        this.UIRoot = UIRoot;
    }
    public async init() {
        this.renderer = new WebGPURenderer({ canvas: this.canvas, powerPreference: "high-performance" });

        this.renderer.autoClearColor = false;
        this.renderer.autoClearDepth = false;
        this.renderer.autoClearStencil = false;

        this.resize();
        window.addEventListener("resize", () => this.resize());
        
        await this.initMaterials();        
        await this.initSkybox();

        await this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(time => this.render(time));
    }

    public async render(time: number) {
        time /= 1000;
        const dt = (time - this.lastRenderTime);
        this.lastRenderTime = time;

        
        if(this.worldRenderer != null) {
            this.emit("frame", time, dt);
            this.worldRenderer.update(dt);

            const skyboxCamera = this.camera.clone();
            skyboxCamera.position.set(0, 0, 0);

            await this.renderer.clearDepth();
            await this.renderer.clearStencil();
            await this.renderer.render(this.skybox, skyboxCamera);
            await this.renderer.clearDepth();
            await this.renderer.render(this.scene, this.camera);
        }

        requestAnimationFrame(time => this.render(time));
    }
    public resize() {
        this.renderer.setPixelRatio(devicePixelRatio);
        this.renderer.setSize(innerWidth, innerHeight);

        this.canvas.width = innerWidth * devicePixelRatio;
        this.canvas.height = innerHeight * devicePixelRatio;

        if(this.camera instanceof PerspectiveCamera) {
            this.camera.aspect = innerWidth / innerHeight;
            this.camera.updateProjectionMatrix();
        }

        this.emit("resize");
    }

    private async initMaterials() {
        const material = new MeshBasicNodeMaterial();
    
        material.colorNode = terrainColor();
    
        this.terrainShader = material;
    }

    private async initSkybox() {
        const material = new MeshBasicNodeMaterial();

        material.colorNode = skyColor();
        
        const cube = new Mesh(new BoxGeometry(10, 10, 10), material);
        cube.geometry.scale(-1, -1, -1);
        this.skybox.add(cube);
    }

    public setWorld(world: World) {
        if(this.world == world) return;

        this.world = world;
        this.worldRenderer = new WorldRenderer(this.world, this.scene, this.terrainShader);
    }

    public async showUI(container: UIContainer) {
        this.showingUIs.add(container);
        this.UIRoot.appendChild(await container.update());
    }
    public hideUI(container: UIContainer) {
        this.showingUIs.delete(container);
        this.UIRoot.removeChild(container.element);
    }
}