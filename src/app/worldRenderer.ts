import { Mesh, Scene } from "three";
import { CHUNK_BLOCK_INC_BYTE, VoxelGridChunk } from "./voxelGrid";
import { VoxelMesher } from "./voxelMesher";
import { World } from "./world";
import { MeshBasicNodeMaterial } from "three/src/Three.WebGPU";

export class WorldRenderer {
    public world: World;
    public mesher: VoxelMesher;
    public meshes: Map<VoxelGridChunk, Mesh> = new Map;
    public scene: Scene;
    public terrainShader: MeshBasicNodeMaterial;

    constructor(world: World, scene: Scene, terrainShader: MeshBasicNodeMaterial) {
        this.world = world;
        this.scene = scene;
        this.terrainShader = terrainShader;
        
        this.mesher = new VoxelMesher(this.world.blocks);
    }
    

    public renderChunk(chunk: VoxelGridChunk) {
        let mesh = this.meshes.get(chunk);
        if(mesh != null) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }

        const geometry = this.mesher.mesh(chunk);
        
        if(geometry.index.count == 0) {
            this.meshes.delete(chunk);
        } else {
            mesh = new Mesh(geometry, this.terrainShader);
            mesh.position.set(chunk.x << CHUNK_BLOCK_INC_BYTE, chunk.y << CHUNK_BLOCK_INC_BYTE, chunk.z << CHUNK_BLOCK_INC_BYTE);
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            this.scene.add(mesh);

            this.meshes.set(chunk, mesh);
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
}