import { Color, Mesh } from "three";
import { CHUNK_BLOCK_INC_BYTE, VoxelGrid, VoxelGridChunk } from "./voxelGrid";
import { VoxelMesher } from "./voxelRenderer";

export type ColorType = Color | number | null;

export class World {
    public blocks: VoxelGrid = new VoxelGrid;
    public renderer: VoxelMesher;
    public meshes: Map<VoxelGridChunk, Mesh> = new Map;
    public dirtyChunkQueue: Set<VoxelGridChunk> = new Set;

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

    public setColor(x: number, y: number, z: number, color: ColorType) {
        const colorValue = this.getValueFromColor(color);
        const chunk = this.blocks.getChunk(x >> CHUNK_BLOCK_INC_BYTE, y >> CHUNK_BLOCK_INC_BYTE, z >> CHUNK_BLOCK_INC_BYTE);

        chunk.set(
            (x - (x >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE)),
            (y - (y >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE)),
            (z - (z >> CHUNK_BLOCK_INC_BYTE << CHUNK_BLOCK_INC_BYTE)),
            colorValue
        );

        this.updateBlock(chunk);
    }

    public updateBlock(chunk: VoxelGridChunk) {
        const { x, y, z } = chunk;

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
    }

    public markChunkDirty(chunk: VoxelGridChunk) {
        this.dirtyChunkQueue.add(chunk);
    }
}