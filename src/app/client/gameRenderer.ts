import { uniform } from "three/src/nodes/TSL";
import { BoxGeometry, BufferGeometry, HemisphereLight, ImageLoader, Mesh, MeshBasicMaterial, MeshBasicNodeMaterial, PerspectiveCamera, Scene, WebGPURenderer } from "three/src/Three.WebGPU";
import { TypedEmitter } from "tiny-typed-emitter";
import { dlerp } from "../math";
import { skyColor } from "../shaders/sky";
import { terrainColor } from "../shaders/terrain";
import { CHUNK_SIZE } from "../world/voxelGrid";
import { World } from "../world/world";
import { WorldRenderer } from "../world/worldRenderer";
import { Client } from "./client";
import { TimeMetric } from "./updateMetric";
import { GameUIControl } from "../gameUIControl";

interface GameRendererEvents {
    "update": (metric: TimeMetric) => void;
    "render": (metric: TimeMetric) => void;
    "resize": () => void;
}

export class GameRenderer extends TypedEmitter<GameRendererEvents> {
    public world: World = null;
    public worldRenderer: WorldRenderer = null;

    public canvas: HTMLCanvasElement;
    public renderer: WebGPURenderer = null;
    public camera: PerspectiveCamera = new PerspectiveCamera(90, 1, 0.01, 3000);
    public scene: Scene = new Scene();
    public skybox: Scene = new Scene();
    private frameTimes: number[] = new Array;

    public maxFps = 3000;
    public maxUps = 3000;
    private lastRenderTime: number = 0;
    private lastUpdateTime: number = 0;
    private regainingRendererContext = false;
    public framerate = 0;
    public frametime = 0;
    public gameUIControl: GameUIControl;

    private terrainMaterial: MeshBasicNodeMaterial = null;
    public budgetTime = 15;

    public setWhiteoutEnabled(enabled: boolean) {
        if(enabled) {
            this.scene.overrideMaterial = new MeshBasicMaterial({ color: 0xffffff });
        } else {
            this.scene.overrideMaterial = null;
        }
    }
    

    constructor(gameUIControl: GameUIControl) {
        super();
        
        this.gameUIControl = gameUIControl;
        this.canvas = gameUIControl.getCanvas();
    }
    public async init() {
        await this.initRenderer();

        this.resize();
        window.addEventListener("resize", () => this.resize());

        this.scene.add(new HemisphereLight(0xffffff, 0x000000));
        
        await this.initMaterials();
        await this.initSkybox();

        await this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(time => this.render(time));
    }

    private async initRenderer() {
        this.renderer = new WebGPURenderer({ canvas: this.canvas, powerPreference: "high-performance", antialias: false });

        this.renderer.autoClearColor = false;
        this.renderer.autoClearDepth = false;
        this.renderer.autoClearStencil = false;
        this.renderer.info.autoReset = false;

        this.renderer.onDeviceLost = (info) => {
            if(this.regainingRendererContext) return;
            this.regainingRendererContext = true;

            console.log("Device lost!", info);
            setTimeout(() => {
                console.log("Recreating renderer...");
                
                this.initRenderer()
                .then(() => {
                    this.regainingRendererContext = false;
                })
                .catch(e => {
                    console.error(new Error("Failed to re-initialize renderer", { cause: e }));

                    let attempts = 0;
                    const interval = setInterval(() => {
                        attempts++;
                        console.log("Recreating renderer (" + attempts + ")...");
                        this.initRenderer()
                        .then(() => {
                            this.regainingRendererContext = false;
                            clearInterval(interval);
                        })
                        .catch(e => {
                            console.warn(new Error("Failed to recreate renderer", { cause: e }));
                        })
                    }, 2000);
                });
            }, 100);
        }

        await this.renderer.init();
    }

    public async render(time: number) {
        requestAnimationFrame(time => this.render(time));

        const doRender = time > this.lastRenderTime + 1000 / this.maxFps;
        const doUpdate = time > this.lastUpdateTime + 1000 / this.maxUps;

        const budget = {
            msLeft: this.budgetTime
        };

        const renderMetric: TimeMetric = {
            timeMs: time, time: time / 1000,
            dt: (time - this.lastRenderTime) / 1000,
            dtMs: (time - this.lastRenderTime),
            budget
        };
        const updateMetric: TimeMetric = {
            timeMs: time, time: time / 1000,
            dt: (time - this.lastUpdateTime) / 1000,
            dtMs: (time - this.lastUpdateTime),
            budget
        };

        if(doRender) {
            this.lastRenderTime = time;
        }
        if(doUpdate) {
            this.lastUpdateTime = time;
        }

        
        const t0 = performance.now();
        if(doUpdate) this.emit("update", renderMetric);
        if(doRender) this.emit("render", renderMetric);

        if(this.worldRenderer != null) {
            if(doUpdate) {
                this.worldRenderer.update(updateMetric);
            }

            if(doRender) {
                const prevPos = this.camera.position.clone();
                this.camera.position.set(0, 0, 0);

                await this.renderer.clearDepth();
                await this.renderer.clearStencil();
                await this.renderer.renderAsync(this.skybox, this.camera);
                await this.renderer.clearDepth();
                this.camera.position.copy(prevPos);
                await this.renderer.renderAsync(this.scene, this.camera);
            }
        }
        const t1 = performance.now();

        if(doRender) {
            this.frameTimes.push(renderMetric.time);
            while(renderMetric.time - this.frameTimes[0] > 1) this.frameTimes.shift();
            this.framerate = dlerp(this.framerate, this.frameTimes.length, renderMetric.dt, 10);
        }
        if(doUpdate) {
            this.frametime = dlerp(this.frametime, t1 - t0, renderMetric.dt, 3);
        }
    }
    public async exportSnapshot() {
        const canvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        const ctx = canvas.getContext("2d");

        const image = await new ImageLoader().loadAsync(this.canvas.toDataURL());
        ctx.drawImage(image, 0, 0);

        return canvas.convertToBlob();
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
    
        const viewDistance = uniform(1);
        viewDistance.onFrameUpdate(() => Math.floor(Client.instance.gameData.clientOptions.viewDistance) * CHUNK_SIZE);
        material.colorNode = terrainColor(viewDistance);
    
        this.terrainMaterial = material;
    }

    private async initSkybox() {
        const material = new MeshBasicNodeMaterial();

        material.colorNode = skyColor();
        
        const cube = new Mesh(new BoxGeometry(10, 10, 10), material);
        cube.geometry.scale(-1, -1, -1);
        this.skybox.add(cube);
    }

    public async compileMaterials() {
        await this.renderer.compileAsync(this.skybox, this.camera);
        await this.renderer.compileAsync(new Mesh(new BufferGeometry, this.terrainMaterial), this.camera);
    }

    public setWorld(world: World) {
        if(this.world == world) return;

        this.world = world;
        
        if(this.worldRenderer != null) {
            this.scene.remove(this.worldRenderer.root);
            this.worldRenderer.destroy();
        }
        this.worldRenderer = new WorldRenderer(this.world, this.terrainMaterial);
        this.scene.add(this.worldRenderer.root);
    }

    public destroyWorldRenderer() {
        console.trace("destroy world renderer");
        this.worldRenderer.destroy();
        this.worldRenderer = null;
    }
}