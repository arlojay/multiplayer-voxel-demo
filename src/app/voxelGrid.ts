import { AugmentedUint16Array, Uint16ArrayPool } from "./arrayPool";

export const SOLID_BITMASK = 1 << 15;
export const AIR_VALUE = 0b100000000000000000000000;

export const BLOCK_INC_SCL = 4;
export const BLOCK_X_INC_BYTE = BLOCK_INC_SCL * 2;
export const BLOCK_Y_INC_BYTE = BLOCK_INC_SCL * 0;
export const BLOCK_Z_INC_BYTE = BLOCK_INC_SCL * 1;

export const CHUNK_INC_SCL = 4;
export const CHUNK_X_INC_BYTE = CHUNK_INC_SCL * 2;
export const CHUNK_Y_INC_BYTE = CHUNK_INC_SCL * 0;
export const CHUNK_Z_INC_BYTE = CHUNK_INC_SCL * 1;
export const CHUNK_BLOCK_INC_BYTE = CHUNK_INC_SCL;

export const REGION_INC_SCL = 4;
export const REGION_X_INC_BYTE = REGION_INC_SCL * 2;
export const REGION_Y_INC_BYTE = REGION_INC_SCL * 0;
export const REGION_Z_INC_BYTE = REGION_INC_SCL * 1;
export const REGION_BLOCK_INC = CHUNK_BLOCK_INC_BYTE + REGION_INC_SCL;

export const CHUNK_SIZE = 1 << CHUNK_INC_SCL;
export const REGION_SIZE = 1 << REGION_INC_SCL;

const REGION_VOLUME = (1 << REGION_INC_SCL) ** 3;



export class VoxelGridChunk {
    data: AugmentedUint16Array;
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
        this.data = Uint16ArrayPool.create();
        this.x = x;
        this.y = y;
        this.z = z;
    }
    
    get(x: number, y: number, z: number): number {
        return this.data[x << BLOCK_X_INC_BYTE | y << BLOCK_Y_INC_BYTE | z << BLOCK_Z_INC_BYTE];
    }
    set(x: number, y: number, z: number, value: number): void {
        this.data[x << BLOCK_X_INC_BYTE | y << BLOCK_Y_INC_BYTE | z << BLOCK_Z_INC_BYTE] = value;
    }
    dispose(): void {
        this.data.dispose();
    }
}

export class VoxelGridRegion {
    chunks: VoxelGridChunk[];
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
        this.chunks = new Array(CHUNK_SIZE ** 3);
        this.x = x;
        this.y = y;
        this.z = z;
    }

    chunkExists(x: number, y: number, z: number): boolean {
        return this.chunks[x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE] != null;
    }
    getChunk(x: number, y: number, z: number, create = true): VoxelGridChunk {
        let chunk = this.chunks[x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE];
        if(chunk == null && create) {
            chunk = this.createChunk(x, y, z);
        }
        return chunk;
    }
    createChunk(x: number, y: number, z: number): VoxelGridChunk {
        return this.chunks[x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE] = new VoxelGridChunk(x + this.x * REGION_SIZE, y + this.y * REGION_SIZE, z + this.z * REGION_SIZE);
    }

    get(x: number, y: number, z: number, createChunk = true): number {
        const chunk = this.getChunk(
            x >> CHUNK_INC_SCL,
            y >> CHUNK_INC_SCL,
            z >> CHUNK_INC_SCL,
            createChunk
        );
        if(chunk == null) return AIR_VALUE;

        return chunk.get(
            x - (x >> CHUNK_INC_SCL << CHUNK_INC_SCL),
            y - (y >> CHUNK_INC_SCL << CHUNK_INC_SCL),
            z - (z >> CHUNK_INC_SCL << CHUNK_INC_SCL),
        );
    }
    set(x: number, y: number, z: number, value: number): void {
        const chunk = this.getChunk(
            x >> CHUNK_INC_SCL,
            y >> CHUNK_INC_SCL,
            z >> CHUNK_INC_SCL
        );
        chunk.set(
            x - (x >> CHUNK_INC_SCL << CHUNK_INC_SCL),
            y - (y >> CHUNK_INC_SCL << CHUNK_INC_SCL),
            z - (z >> CHUNK_INC_SCL << CHUNK_INC_SCL),
            value
        );
    }
    dispose(): void {
        let chunk;
        for(let i = 0; i < REGION_VOLUME; i++) {
            if((chunk = this.chunks[i]) == null) continue;
            chunk.dispose();
        }
    }
}

export class VoxelGrid {
    regions: Map<string, VoxelGridRegion>;
    cachedRegion: VoxelGridRegion;
    cachedRegionX: number;
    cachedRegionY: number;
    cachedRegionZ: number;

    constructor() {
        this.regions = new Map;
        this.cachedRegion = null;
        this.cachedRegionX = Infinity;
        this.cachedRegionY = Infinity;
        this.cachedRegionZ = Infinity;
    }
    getRegion(x: number, y: number, z: number): VoxelGridRegion {
        if(x == this.cachedRegionX && y == this.cachedRegionY && z == this.cachedRegionZ) return this.cachedRegion;
        this.cachedRegionX = x;
        this.cachedRegionY = y;
        this.cachedRegionZ = z;
        const key = x + "," + y + "," + z;
        let cachedRegion = this.regions.get(key);
        if(cachedRegion == null) {
            cachedRegion = new VoxelGridRegion(x, y, z);
            this.regions.set(key, cachedRegion);
        }
        return this.cachedRegion = cachedRegion;
    }
    chunkExists(x: number, y: number, z: number): boolean {
        const region = this.getRegion(
            x >> REGION_INC_SCL,
            y >> REGION_INC_SCL,
            z >> REGION_INC_SCL
        );

        return region.chunkExists(
            x - (x >> REGION_INC_SCL << REGION_INC_SCL),
            y - (y >> REGION_INC_SCL << REGION_INC_SCL),
            z - (z >> REGION_INC_SCL << REGION_INC_SCL)
        );
    }
    getChunk(x: number, y: number, z: number, create = true): VoxelGridChunk {
        const region = this.getRegion(
            x >> REGION_INC_SCL,
            y >> REGION_INC_SCL,
            z >> REGION_INC_SCL
        );

        return region.getChunk(
            x - (x >> REGION_INC_SCL << REGION_INC_SCL),
            y - (y >> REGION_INC_SCL << REGION_INC_SCL),
            z - (z >> REGION_INC_SCL << REGION_INC_SCL),
            create
        );
    }
    get(x: number, y: number, z: number, createChunk = true): number {
        const region = this.getRegion(
            x >> REGION_BLOCK_INC,
            y >> REGION_BLOCK_INC,
            z >> REGION_BLOCK_INC
        );

        return region.get(
            x - (x >> REGION_BLOCK_INC << REGION_BLOCK_INC),
            y - (y >> REGION_BLOCK_INC << REGION_BLOCK_INC),
            z - (z >> REGION_BLOCK_INC << REGION_BLOCK_INC),
            createChunk
        );
    }
    set(x: number, y: number, z: number, value: number): void {
        const region = this.getRegion(
            x >> REGION_BLOCK_INC,
            y >> REGION_BLOCK_INC,
            z >> REGION_BLOCK_INC
        );

        region.set(
            x - (x >> REGION_BLOCK_INC << REGION_BLOCK_INC),
            y - (y >> REGION_BLOCK_INC << REGION_BLOCK_INC),
            z - (z >> REGION_BLOCK_INC << REGION_BLOCK_INC),
            value
        );
    }
}