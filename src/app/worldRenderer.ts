import { Mesh, Scene } from "three";
import { CHUNK_BLOCK_INC_BYTE } from "./voxelGrid";
import { VoxelMesher } from "./voxelMesher";
import { Chunk, World } from "./world";
import { MeshBasicNodeMaterial } from "three/src/Three.WebGPU";

export class WorldRenderer {
    public world: World;
    public mesher: VoxelMesher;
    public scene: Scene;
    public terrainShader: MeshBasicNodeMaterial;

    constructor(world: World, scene: Scene, terrainShader: MeshBasicNodeMaterial) {
        this.world = world;
        this.scene = scene;
        this.terrainShader = terrainShader;
        
        this.mesher = new VoxelMesher(this.world.blocks);
    }
    

    public renderChunk(chunk: Chunk) {
        let mesh = chunk.mesh;
        console.log(chunk);
        if(mesh != null) {
            this.scene.remove(mesh);
            chunk.deleteMesh();
        }

        const geometry = this.mesher.mesh(chunk);
        
        if(geometry.index.count > 0) {
            mesh = new Mesh(geometry, this.terrainShader);
            mesh.position.set(chunk.x << CHUNK_BLOCK_INC_BYTE, chunk.y << CHUNK_BLOCK_INC_BYTE, chunk.z << CHUNK_BLOCK_INC_BYTE);
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            this.scene.add(mesh);

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
}