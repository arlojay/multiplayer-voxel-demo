import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import { color, dot, normalFlat, texture, vec3, vertexColor } from "three/src/nodes/TSL";
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, Texture, Vector3, WebGPURenderer } from "three/src/Three.WebGPU";
import { BlockRegistry } from "../block/blockRegistry";
import { BlockState, BlockStateSaveKey } from "../block/blockState";
import { BlockStateType } from "../block/blockStateType";


export class DisplayBlockRenderer {
    public renderer: WebGPURenderer;
    private canvas: HTMLCanvasElement;

    public camera = new OrthographicCamera;
    public models: Map<string, Mesh> = new Map;
    public images: Map<string, ImageData> = new Map;
    private materials: Map<Texture, MeshBasicNodeMaterial> = new Map;

    constructor() {
        this.canvas = document.createElement("canvas");
        this.renderer = new WebGPURenderer({ powerPreference: "low-power", canvas: this.canvas, alpha: true, antialias: true });

        this.camera.position.set(0, 0, 3);
        this.camera.near = 1;
        this.camera.far = 5;
    }

    public getImage(state: BlockStateSaveKey | BlockStateType | BlockState) {
        if(state instanceof BlockState) {
            return this.images.get(state.getSaveKey());
        }
        if(state instanceof BlockStateType) {
            return this.images.get(state.saveKey);
        }
        return this.images.get(state);
    }

    public async build(blocks: BlockRegistry, progressCallback?: (finished: number, total: number) => void) {
        const t0 = performance.now();
        await this.renderer.init();

        const scene = new Scene;
        const blockViewSize = 64;

        progressCallback?.(0, 3);
        await new Promise(requestAnimationFrame);

        let totalCount = 0;
        const meshes: Map<string, Mesh> = new Map;
        for(const block of blocks.values()) {
            for(const state of block.states.values()) {
                meshes.set(state.saveKey, this.buildModelMesh(state));
                totalCount++;
            }
        }

        progressCallback?.(1, 3);
        await new Promise(requestAnimationFrame);
        
        console.log("Built " + totalCount + " block meshes in " + Math.round(performance.now() - t0) + "ms");
        const t1 = performance.now();

        const sizeX = Math.ceil(Math.sqrt(totalCount));
        const sizeY = Math.ceil(totalCount / sizeX);
        

        let index = 0;
        for(const block of blocks.values()) {
            for(const state of block.states.values()) {
                const x = index % sizeX;
                const y = Math.floor(index / sizeX);

                const mesh = meshes.get(state.saveKey);

                const scl = 1.27083333;
                mesh.scale.set(scl, scl, scl);
                mesh.rotateX(Math.PI * 1/6);
                mesh.rotateY(Math.PI * -1/4);

                mesh.position.set(x * 2 + 1, y * 2 + 1, 0);
                scene.add(mesh);

                index++;
            }
        }

        progressCallback?.(2, 3);
        await new Promise(requestAnimationFrame);

        this.camera.left = 0;
        this.camera.right = sizeX * 2;
        this.camera.bottom = 0;
        this.camera.top = sizeY * 2;

        this.renderer.setSize(sizeX * blockViewSize, sizeY * blockViewSize);
        await this.renderer.renderAsync(scene, this.camera);
        
        progressCallback?.(3, 3);
        await new Promise(requestAnimationFrame);

        console.debug("Rendered " + totalCount + " blocks in " + Math.round(performance.now() - t1) + "ms");
        const t2 = performance.now();

        const canvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.canvas, 0, 0);

        index = 0;
        for(const block of blocks.values()) {
            for(const state of block.states.values()) {
                const x = index % sizeX;
                const y = Math.floor(index / sizeX);

                this.images.set(
                    state.saveKey,
                    ctx.getImageData(
                        x * blockViewSize,
                        (sizeY - y - 1) * blockViewSize,
                        blockViewSize,
                        blockViewSize
                    )
                );
                index++;
            }
        }
        console.debug("Sliced " + totalCount + " blocks in " + Math.round(performance.now() - t2) + "ms");
    }

    private getMaterial(faceTexture: Texture) {
        if(this.materials.has(faceTexture)) return this.materials.get(faceTexture);

        const colorNode = texture(faceTexture).mul(vertexColor()).mix(
            color(0, 0, 0),
            dot(
                normalFlat,
                vec3(1, 3, 2).normalize()
            ).remap(-1, 1, 0.6, 1)
        );

        const material = new MeshBasicNodeMaterial({ colorNode })
        this.materials.set(faceTexture, material);
        return material;
    }

    private buildModelMesh(state: BlockStateType) {
        const geometryList: PlaneGeometry[] = new Array;
        const materialList: MeshBasicNodeMaterial[] = new Array;

        const size = new Vector3;
        const center = new Vector3;

        for(const cuboid of state.model.cuboids) {
            cuboid.size.getSize(size);
            cuboid.size.getCenter(center);

            if(cuboid.south != null) {
                const south = new PlaneGeometry(size.x, size.y);
                south.setAttribute("color", new Float32BufferAttribute(new Float32Array([
                    cuboid.south.color.r, cuboid.south.color.g, cuboid.south.color.b,
                    cuboid.south.color.r, cuboid.south.color.g, cuboid.south.color.b,
                    cuboid.south.color.r, cuboid.south.color.g, cuboid.south.color.b,
                    cuboid.south.color.r, cuboid.south.color.g, cuboid.south.color.b
                ]), 3));
                south.translate(center.x, center.y, cuboid.size.max.z);
                materialList.push(this.getMaterial(cuboid.south.texture.getTexture()));

                geometryList.push(south);
            }
            // if(cuboid.north != null) {
            //     const north = new PlaneGeometry(size.x, size.y);
            //     north.setAttribute("color", new Float32BufferAttribute(new Float32Array([
            //         cuboid.north.color.r, cuboid.north.color.g, cuboid.north.color.b,
            //         cuboid.north.color.r, cuboid.north.color.g, cuboid.north.color.b,
            //         cuboid.north.color.r, cuboid.north.color.g, cuboid.north.color.b,
            //         cuboid.north.color.r, cuboid.north.color.g, cuboid.north.color.b
            //     ]), 3));
            //     north.rotateY(Math.PI);
            //     north.translate(center.x, center.y, cuboid.size.min.z);
            //     materialList.push(this.getMaterial(cuboid.north.texture.getTexture()));

            //     geometryList.push(north);
            // }
            if(cuboid.east != null) {
                const east = new PlaneGeometry(size.z, size.y);
                east.setAttribute("color", new Float32BufferAttribute(new Float32Array([
                    cuboid.east.color.r, cuboid.east.color.g, cuboid.east.color.b,
                    cuboid.east.color.r, cuboid.east.color.g, cuboid.east.color.b,
                    cuboid.east.color.r, cuboid.east.color.g, cuboid.east.color.b,
                    cuboid.east.color.r, cuboid.east.color.g, cuboid.east.color.b
                ]), 3));
                east.rotateY(Math.PI * 0.5);
                east.translate(cuboid.size.max.x, center.y, center.z);
                materialList.push(this.getMaterial(cuboid.east.texture.getTexture()));

                geometryList.push(east);
            }
            // if(cuboid.west != null) {
            //     const west = new PlaneGeometry(size.z, size.y);
            //     west.setAttribute("color", new Float32BufferAttribute(new Float32Array([
            //         cuboid.west.color.r, cuboid.west.color.g, cuboid.west.color.b,
            //         cuboid.west.color.r, cuboid.west.color.g, cuboid.west.color.b,
            //         cuboid.west.color.r, cuboid.west.color.g, cuboid.west.color.b,
            //         cuboid.west.color.r, cuboid.west.color.g, cuboid.west.color.b
            //     ]), 3));
            //     west.rotateY(Math.PI * -0.5);
            //     west.translate(cuboid.size.min.x, center.y, center.z);
            //     materialList.push(this.getMaterial(cuboid.west.texture.getTexture()));

            //     geometryList.push(west);
            // }
            if(cuboid.up != null) {
                const up = new PlaneGeometry(size.x, size.z);
                up.setAttribute("color", new Float32BufferAttribute(new Float32Array([
                    cuboid.up.color.r, cuboid.up.color.g, cuboid.up.color.b,
                    cuboid.up.color.r, cuboid.up.color.g, cuboid.up.color.b,
                    cuboid.up.color.r, cuboid.up.color.g, cuboid.up.color.b,
                    cuboid.up.color.r, cuboid.up.color.g, cuboid.up.color.b
                ]), 3));
                up.rotateX(Math.PI * -0.5);
                up.translate(center.x, cuboid.size.max.y, center.z);
                materialList.push(this.getMaterial(cuboid.up.texture.getTexture()));

                geometryList.push(up);
            }
            // if(cuboid.down != null) {
            //     const down = new PlaneGeometry(size.z, size.y);
            //     down.setAttribute("color", new Float32BufferAttribute(new Float32Array([
            //         cuboid.down.color.r, cuboid.down.color.g, cuboid.down.color.b,
            //         cuboid.down.color.r, cuboid.down.color.g, cuboid.down.color.b,
            //         cuboid.down.color.r, cuboid.down.color.g, cuboid.down.color.b,
            //         cuboid.down.color.r, cuboid.down.color.g, cuboid.down.color.b
            //     ]), 3));
            //     down.rotateX(Math.PI * 0.5);
            //     down.translate(center.x, cuboid.size.min.y, center.z);
            //     materialList.push(this.getMaterial(cuboid.down.texture.getTexture()));

            //     geometryList.push(down);
            // }
        }
        

        const geometry = geometryList.length == 0 ? new BufferGeometry : mergeGeometries(geometryList, true);
        geometry.translate(-0.5, -0.5, -0.5);
        
        geometry.computeTangents();
        return new Mesh(geometry, materialList);
    }
}