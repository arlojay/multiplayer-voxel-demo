import { Mesh } from "three";
import { BufferGeometry, Group, MaterialNode, MeshBasicNodeMaterial, Object3D } from "three/src/Three.WebGPU";
import { CHUNK_BLOCK_INC_BYTE } from "./voxelGrid";
import { VoxelMesher } from "./voxelMesher";
import { Chunk, World } from "./world";

export class WorldRenderer {
    public world: World;
    public mesher: VoxelMesher;
    public root: Group = new Group;
    public terrainShader: MeshBasicNodeMaterial;

    constructor(world: World, terrainShader: MeshBasicNodeMaterial) {
        this.world = world;
        this.terrainShader = terrainShader;
        
        this.mesher = new VoxelMesher(this.world);
    }
    

    public renderChunk(chunk: Chunk) {
        let mesh = chunk.mesh;
        if(mesh != null) {
            this.root.remove(mesh);
            chunk.deleteMesh();
        }

        const geometry = this.mesher.mesh(chunk);
        
        if(geometry.index.count > 0) {
            mesh = new Mesh(geometry, this.terrainShader);
            mesh.position.set(chunk.x << CHUNK_BLOCK_INC_BYTE, chunk.y << CHUNK_BLOCK_INC_BYTE, chunk.z << CHUNK_BLOCK_INC_BYTE);
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            this.root.add(mesh);

            chunk.setMesh(mesh);
        }
    }

    public update(dt: number) {
        const dirtyChunkQueue = this.world.dirtyChunkQueue;
        const count = Math.max(10, Math.round(dirtyChunkQueue.size * 0.1));
        
        for(const chunk of dirtyChunkQueue.keys().take(count)) {
            dirtyChunkQueue.delete(chunk);

            this.renderChunk(chunk);
        }
    }

    public destroy() {
        const objects: Set<Object3D> = new Set;
        const geometries: Set<BufferGeometry> = new Set;
        const materials: Set<MaterialNode> = new Set;
        this.root.traverse(o => {
            if("geometry" in o && o.geometry instanceof BufferGeometry) {
                geometries.add(o.geometry);
            }
            if("material" in o && o.material instanceof MaterialNode) {
                materials.add(o.material);
            }
            objects.add(o);
        });
        for(const geometry of geometries) {
            geometry.dispose();
        }
        for(const material of materials) {
            material.dispose();
        }
        for(const object of objects) {
            object.remove();
        }
    }
}