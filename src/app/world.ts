import { Color, Mesh } from "three";
import { Server } from "./server/server";
import { CHUNK_BLOCK_INC_BYTE, VoxelGrid, VoxelGridChunk } from "./voxelGrid";
import { WorldRaycaster } from "./worldRaycaster";
import { AIR_BIT } from "./voxelMesher";

export type ColorType = Color | number | null;

export class World {
    public server: Server = null;
    public blocks: VoxelGrid = new VoxelGrid;
    public meshes: Map<VoxelGridChunk, Mesh> = new Map;
    public dirtyChunkQueue: Set<VoxelGridChunk> = new Set;
    public raycaster = new WorldRaycaster(this);

    public constructor(server?: Server) {
        this.server = server;
    }

    public getValueFromColor(color: ColorType): number {
        if(color == null) return 0;

        if(color instanceof Color) {
            return (
                1 << 15 |
                Math.round(color.r * 32) << 10 |
                Math.round(color.g * 32) << 5 |
                Math.round(color.b * 32) << 0
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

    public getRawValue(x: number, y: number, z: number) {
        return this.blocks.get(x, y, z);
    }

    public setColor(x: number, y: number, z: number, color: ColorType, update = true) {
        this.setRawValue(x, y, z, this.getValueFromColor(color), update);
    }

    public clearColor(x: number, y: number, z: number, update = true) {
        // alert(AIR_BIT.toString(2));
        this.setRawValue(x, y, z, ~AIR_BIT, update);
    }

    public setRawValue(x: number, y: number, z: number, value: number, update = true) {
        const chunk = this.blocks.getChunk(x >> CHUNK_BLOCK_INC_BYTE, y >> CHUNK_BLOCK_INC_BYTE, z >> CHUNK_BLOCK_INC_BYTE);

        chunk.set(
            (x - (x >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE)),
            (y - (y >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE)),
            (z - (z >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE)),
            value
        );

        if(update) this.updateBlock(x, y, z, chunk);
    }

    public updateBlock(x: number, y: number, z: number, chunk: VoxelGridChunk) {
        const chunkX = x >> CHUNK_BLOCK_INC_BYTE;
        const chunkY = y >> CHUNK_BLOCK_INC_BYTE;
        const chunkZ = z >> CHUNK_BLOCK_INC_BYTE;

        const relativeX = x - (chunkX << CHUNK_BLOCK_INC_BYTE);
        const relativeY = y - (chunkY << CHUNK_BLOCK_INC_BYTE);
        const relativeZ = z - (chunkZ << CHUNK_BLOCK_INC_BYTE);

        this.markChunkDirty(chunk);

        if(relativeX == 0) this.markChunkDirty(this.blocks.getChunk(chunkX - 1, chunkY, chunkZ));
        if(relativeX == 15) this.markChunkDirty(this.blocks.getChunk(chunkX + 1, chunkY, chunkZ));
        if(relativeY == 0) this.markChunkDirty(this.blocks.getChunk(chunkX, chunkY - 1, chunkZ));
        if(relativeY == 15) this.markChunkDirty(this.blocks.getChunk(chunkX, chunkY + 1, chunkZ));
        if(relativeZ == 0) this.markChunkDirty(this.blocks.getChunk(chunkX, chunkY, chunkZ - 1));
        if(relativeZ == 15) this.markChunkDirty(this.blocks.getChunk(chunkX, chunkY, chunkZ + 1));

        if(this.server != null) {
            this.server.updateBlock(this, x, y, z);
        }
    }

    public markChunkDirty(chunk: VoxelGridChunk) {
        this.dirtyChunkQueue.add(chunk);
    }
}