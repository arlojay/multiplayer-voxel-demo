import { BoxGeometry, Camera, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, Scene, WebGPURenderer } from "three/src/Three.WebGPU";
import { TypedEmitter } from "tiny-typed-emitter";
import { World } from "./world";
import { WorldRenderer } from "./worldRenderer";
import { abs, attribute, color, dot, float, Fn, If, mix, normalize, positionLocal, select, smoothstep, uniform, vec2, vec3, vertexColor } from "three/src/nodes/TSL";

interface GameRendererEvents {
    "frame": (time: number, dt: number) => void;
    "resize": () => void;
}

export class GameRenderer extends TypedEmitter<GameRendererEvents> {
    public world: World = null;
    public worldRenderer: WorldRenderer = null;

    public canvas: HTMLCanvasElement;
    public renderer: WebGPURenderer = null;
    public camera: Camera = new PerspectiveCamera(90, 1, 0.01, 3000);
    public scene: Scene = new Scene();
    public skybox: Scene = new Scene();

    private terrainShader: MeshBasicNodeMaterial = null;
    private lastRenderTime: number = 0;
    // public webGPURenderer: WebGPURenderer;

    constructor(canvas: HTMLCanvasElement) {
        super();
        
        this.canvas = canvas;
        // this.webGPURenderer = new WebGPURenderer(canvas);
    }
    public async init() {
        // await this.webGPURenderer.init();
        this.renderer = new WebGPURenderer({ canvas: this.canvas, powerPreference: "high-performance" });

        this.renderer.autoClearColor = false;
        this.renderer.autoClearDepth = false;
        this.renderer.autoClearStencil = false;

        this.resize();
        window.addEventListener("resize", () => this.resize());

        // this.terrainShader = await loadShaderProgram("assets/shaders/terrain", {
        //     time: { value: 0 }
        // });
        
        await this.initMaterials();        
        await this.initSkybox();

        await this.renderer.renderAsync(this.scene, this.camera);
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

        // this.webGPURenderer.render(time);

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

        // this.webGPURenderer.resize();

        this.emit("resize");
    }

    private async initMaterials() {
        const material = new MeshBasicNodeMaterial();
    
        const time = uniform(0);
    
        const localPos = attribute("localPos", "vec3<f32>");
        const vColor = vertexColor();
    
        const manhattanDistance = Fn(({ a = vec3(), b = vec3() }) => {
            return abs(a.x.sub(b.x)).add(abs(a.y.sub(b.y))).add(abs(a.z.sub(b.z)));
        });
    
        const extreme = Fn(({ v = vec3() }) => {
            const a: ReturnType<typeof vec3> = abs(v).toVar();
    
            return vec3(
                select(a.x.greaterThanEqual(a.y).and(a.x.greaterThanEqual(a.z)), v.x, float(0.0)),
                select(a.y.greaterThanEqual(a.x).and(a.y.greaterThanEqual(a.z)), v.y, float(0.0)),
                select(a.z.greaterThanEqual(a.x).and(a.z.greaterThanEqual(a.y)), v.z, float(0.0))
            )
        });
    
        const lum = Fn(({ c = color() }) => {
            return c.r.mul(0.2126).add(c.g.mul(0.7152)).add(c.b.mul(0.0722));
        })
    
        const fragment = Fn(() => {
            const localPosAdjusted = localPos.sub(vec3(0.5)).toVar();
            const adjustedExtreme = extreme({ v: localPosAdjusted }).toVar();
            const normal = normalize(adjustedExtreme).toVar();
            const preUv = localPosAdjusted.sub(adjustedExtreme).toVar();
            const uv = vec2(0.0).toVar();
        
            If(normal.x.notEqual(float(0.0)), () => {
                uv.assign(preUv.zy);
            })
            If(normal.y.notEqual(float(0.0)), () => {
                uv.assign(preUv.xz);
            })
            If(normal.z.notEqual(float(0.0)), () => {
                uv.assign(preUv.xy);
                uv.x.mulAssign(float(-1.0));
            })
        
            const edgeFactor = select(
                abs(uv.x).greaterThan(0.45).or(abs(uv.y).greaterThan(0.45)),
                float(1.0),
                float(0.0)
            );
    
            const sunPos = vec3(0.3, 1.0, 0.6);
            const shadow = dot(normal, normalize(sunPos)).mul(0.5).add(0.5);
            const isLightColor = lum({ c: vColor }).greaterThan(float(0.25));
            const outColor = mix(vColor, vec3(select(isLightColor, float(0.0), float(0.5))), edgeFactor.mul(float(0.5))).mul(shadow);
    
            return outColor;
        })
    
        material.colorNode = fragment();
    
        time.onFrameUpdate(n => n.time);
    
        this.terrainShader = material;
    }

    private async initSkybox() {
        const material = new MeshBasicNodeMaterial();

        const positionNormalized = normalize(positionLocal).toVar();
        material.colorNode = mix(color(0.2, 0.3, 0.4), color(0.6, 0.7, 0.8), smoothstep(float(-0.5), float(0.5), positionNormalized.y)).pow(float(2)).mul(float(1.5));        
        
        const cube = new Mesh(new BoxGeometry(10, 10, 10), material);
        cube.geometry.scale(-1, -1, -1);
        this.skybox.add(cube);
    }

    public setWorld(world: World) {
        if(this.world == world) return;

        this.world = world;
        this.worldRenderer = new WorldRenderer(this.world, this.scene, this.terrainShader);
    }
}