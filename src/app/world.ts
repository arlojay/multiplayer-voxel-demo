import { Color, Mesh } from "three";
import { Server } from "./server/server";
import { AIR_VALUE, CHUNK_BLOCK_INC_BYTE, CHUNK_INC_SCL, CHUNK_SIZE, VoxelGrid, VoxelGridChunk } from "./voxelGrid";
import { WorldRaycaster } from "./worldRaycaster";
import { clamp } from "./math";
import { WorldGenerator } from "./worldGenerator";

export type ColorType = Color | number | null;

export class Chunk {
    public voxelChunk: VoxelGridChunk;
    public x: number;
    public y: number;
    public z: number;
    public blockX: number;
    public blockY: number;
    public blockZ: number;
    public mesh: Mesh | null;

    public surroundedChunks: boolean[] = new Array(27).fill(false);

    constructor(voxelChunk: VoxelGridChunk) {
        this.voxelChunk = voxelChunk;
        this.x = voxelChunk.x;
        this.y = voxelChunk.y;
        this.z = voxelChunk.z;
        this.blockX = voxelChunk.x << CHUNK_INC_SCL;
        this.blockY = voxelChunk.y << CHUNK_INC_SCL;
        this.blockZ = voxelChunk.z << CHUNK_INC_SCL;
    }

    public get get() {
        return this.voxelChunk.get;
    }
    public get set() {
        return this.voxelChunk.set;
    }
    public get data() {
        return this.voxelChunk.data;
    }

    public hasMesh() {
        return this.mesh != null;
    }
    public setMesh(mesh: Mesh) {
        this.mesh = mesh;
    }
    public deleteMesh() {
        this.mesh.geometry.dispose();
        this.mesh = null;
    }

    public markSurrounded(dx: number, dy: number, dz: number) {
        this.surroundedChunks[(dx + 1) * 9 + (dy + 1) * 3 + (dz + 1)] = true;
    }

    // TODO: Fix this in regard to chunk rendering after fetches (medium-bad code smell)
    public isFullySurrounded() {
        return true;
        // return this.hasPosX && this.hasPosY && this.hasPosZ && this.hasNegX && this.hasNegY && this.hasNegZ;
    }
}

export class World {
    public server: Server = null;
    public blocks: VoxelGrid = new VoxelGrid;
    public dirtyChunkQueue: Set<Chunk> = new Set;
    public raycaster = new WorldRaycaster(this);
    public name: string;
    public generator: WorldGenerator;

    public chunkMap: WeakMap<VoxelGridChunk, Chunk> = new Map;

    public constructor(name = "world", server?: Server) {
        this.name = name;
        this.server = server;
    }

    public getValueFromColor(color: ColorType): number {
        if(color == null) return 0;

        if(color instanceof Color) {
            return (
                1 << 15 |
                Math.round(clamp(color.r * 32, 0, 31)) << 10 |
                Math.round(clamp(color.g * 32, 0, 31)) << 5 |
                Math.round(clamp(color.b * 32, 0, 31)) << 0
            );
        } else {
            return (
                1 << 15 |
                (((color & 0xff0000) >> 19) << 10) |
                (((color & 0x00ff00) >> 11) << 5) |
                (((color & 0x0000ff) >> 3) << 0)
            )
        }
    }
    public getColorFromValue(value: number) {
        const r = (value & 0b111110000000000);
        const g = (value & 0b000001111100000);
        const b = (value & 0b000000000011111);

        return (r << 9) | (g << 6) | (b << 3);
    }

    public getRawValue(x: number, y: number, z: number, createChunk = false) {
        return this.blocks.get(x, y, z, createChunk);
    }

    public setColor(x: number, y: number, z: number, color: ColorType, update = true) {
        this.setRawValue(x, y, z, this.getValueFromColor(color), update);
    }

    public clearColor(x: number, y: number, z: number, update = true) {
        this.setRawValue(x, y, z, AIR_VALUE, update);
    }

    public setRawValue(x: number, y: number, z: number, value: number, update = true) {
        const chunk = this.getChunk(x >> CHUNK_BLOCK_INC_BYTE, y >> CHUNK_BLOCK_INC_BYTE, z >> CHUNK_BLOCK_INC_BYTE);

        const blockX = (x - (x >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE));
        const blockY = (y - (y >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE));
        const blockZ = (z - (z >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE));

        if(update) update &&= chunk.get(blockX, blockY, blockZ) != value;
        
        chunk.set(blockX, blockY, blockZ, value);

        if(update) this.updateBlock(x, y, z, chunk);
    }

    public updateBlock(x: number, y: number, z: number, chunk: Chunk) {
        const chunkX = x >> CHUNK_BLOCK_INC_BYTE;
        const chunkY = y >> CHUNK_BLOCK_INC_BYTE;
        const chunkZ = z >> CHUNK_BLOCK_INC_BYTE;

        const relativeX = x - (chunkX << CHUNK_BLOCK_INC_BYTE);
        const relativeY = y - (chunkY << CHUNK_BLOCK_INC_BYTE);
        const relativeZ = z - (chunkZ << CHUNK_BLOCK_INC_BYTE);

        this.markChunkDirty(chunk);

        for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
                for(let dz = -1; dz <= 1; dz++) {
                    if(
                        (relativeX == 15 ? 1 : (relativeX == 0 ? -1 : 0)) == dx ||
                        (relativeY == 15 ? 1 : (relativeY == 0 ? -1 : 0)) == dy ||
                        (relativeZ == 15 ? 1 : (relativeZ == 0 ? -1 : 0)) == dz
                    ) {
                        this.markDirtyByPos(chunkX + dx, chunkY + dy, chunkZ + dz);
                    }
                }
            }
        }

        if(this.server != null) {
            this.server.updateBlock(this, x, y, z);
        }
    }

    public markDirtyByPos(x: number, y: number, z: number) {
        const chunk = this.getChunk(x, y, z, false);
        if(chunk == null) return;
        this.markChunkDirty(chunk);
    }

    public markChunkDirty(chunk: Chunk) {
        this.dirtyChunkQueue.add(chunk);
    }

    public chunkExists(x: number, y: number, z: number) {
        return this.blocks.chunkExists(x, y, z);
    }

    public getChunk(x: number, y: number, z: number, create = false) {
        const voxelChunk = this.blocks.getChunk(x, y, z, create);
        if(voxelChunk == null) return null;

        let chunk = this.chunkMap.get(voxelChunk);
        if(chunk == null && create) {
            chunk = new Chunk(voxelChunk);
            this.chunkMap.set(voxelChunk, chunk);
        }

        return chunk;
    }

    public setGenerator(generator: WorldGenerator) {
        this.generator = generator;
    }
    private warnedAboutNullGenerator = false;
    public generateChunk(x: number, y: number, z: number) {
        if(this.generator == null) {
            if(!this.warnedAboutNullGenerator) {
                console.warn("Generator is null for world " + this.name + "; generating empty chunks");
                this.warnedAboutNullGenerator = true;
            }
            return this.getChunk(x, y, z, true);
        }
        return this.generator.generateChunk(x, y, z);
    }
}