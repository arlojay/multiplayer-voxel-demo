import { AugmentedUint16Array, Uint16ArrayPool } from "./arrayPool";


export const CHUNK_INC_SCL = 4;
export const CHUNK_X_INC_BYTE = CHUNK_INC_SCL * 2;
export const CHUNK_Y_INC_BYTE = CHUNK_INC_SCL * 0;
export const CHUNK_Z_INC_BYTE = CHUNK_INC_SCL * 1;
export const CHUNK_BLOCK_INC_BYTE = CHUNK_INC_SCL;
export const CHUNK_POSITION_X_BITMASK = (1 << CHUNK_INC_SCL) - 1;
export const CHUNK_POSITION_Y_BITMASK = (1 << CHUNK_INC_SCL) - 1;
export const CHUNK_POSITION_Z_BITMASK = (1 << CHUNK_INC_SCL) - 1;

export const REGION_INC_SCL = 4;
export const REGION_X_INC_BYTE = REGION_INC_SCL * 2;
export const REGION_Y_INC_BYTE = REGION_INC_SCL * 0;
export const REGION_Z_INC_BYTE = REGION_INC_SCL * 1;
export const REGION_BLOCK_INC = CHUNK_BLOCK_INC_BYTE + REGION_INC_SCL;

export const BLOCK_X_INC_BYTE = CHUNK_INC_SCL * 2;
export const BLOCK_Y_INC_BYTE = CHUNK_INC_SCL * 0;
export const BLOCK_Z_INC_BYTE = CHUNK_INC_SCL * 1;
export const BLOCK_POSITION_X_BITMASK = (1 << CHUNK_INC_SCL) - 1;
export const BLOCK_POSITION_Y_BITMASK = (1 << CHUNK_INC_SCL) - 1;
export const BLOCK_POSITION_Z_BITMASK = (1 << CHUNK_INC_SCL) - 1;
export const REGION_BLOCK_POSITION_X_BITMASK = (1 << REGION_BLOCK_INC) - 1;
export const REGION_BLOCK_POSITION_Y_BITMASK = (1 << REGION_BLOCK_INC) - 1;
export const REGION_BLOCK_POSITION_Z_BITMASK = (1 << REGION_BLOCK_INC) - 1;

export const CHUNK_SIZE = 1 << CHUNK_INC_SCL;
export const REGION_SIZE = 1 << REGION_INC_SCL;

const REGION_VOLUME = (1 << REGION_INC_SCL) ** 3;



export class VoxelGridChunk {
    public data: AugmentedUint16Array;
    public x: number;
    public y: number;
    public z: number;

    public constructor(x: number, y: number, z: number) {
        this.data = Uint16ArrayPool.create();
        this.x = x;
        this.y = y;
        this.z = z;
    }
    
    public get(x: number, y: number, z: number): number {
        return this.data[x << BLOCK_X_INC_BYTE | y << BLOCK_Y_INC_BYTE | z << BLOCK_Z_INC_BYTE];
    }
    public set(x: number, y: number, z: number, value: number): void {
        this.data[x << BLOCK_X_INC_BYTE | y << BLOCK_Y_INC_BYTE | z << BLOCK_Z_INC_BYTE] = value;
    }
    public dispose(): void {
        this.data.dispose();
    }
}

export class VoxelGridRegion {
    public chunks: VoxelGridChunk[];
    public x: number;
    public y: number;
    public z: number;

    public constructor(x: number, y: number, z: number) {
        this.chunks = new Array(CHUNK_SIZE ** 3);
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public chunkExists(x: number, y: number, z: number): boolean {
        return this.chunks[x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE] != null;
    }
    public getChunk(x: number, y: number, z: number, create = true): VoxelGridChunk {
        let chunk = this.chunks[x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE];
        if(chunk == null && create) {
            chunk = this.createChunk(x, y, z);
        }
        return chunk;
    }
    public deleteChunk(x: number, y: number, z: number) {
        const n = x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE;
        const old = this.chunks[n];
        delete this.chunks[n];
        return old;
    }
    public createChunk(x: number, y: number, z: number): VoxelGridChunk {
        return this.chunks[x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE] = new VoxelGridChunk(x + this.x * REGION_SIZE, y + this.y * REGION_SIZE, z + this.z * REGION_SIZE);
    }

    public get(x: number, y: number, z: number, createChunk = true): number {
        const chunk = this.getChunk(
            x >> CHUNK_INC_SCL,
            y >> CHUNK_INC_SCL,
            z >> CHUNK_INC_SCL,
            createChunk
        );
        if(chunk == null) return 0;

        return chunk.get(
            x & BLOCK_POSITION_X_BITMASK,
            y & BLOCK_POSITION_Y_BITMASK,
            z & BLOCK_POSITION_Z_BITMASK,
        );
    }
    public set(x: number, y: number, z: number, value: number): void {
        const chunk = this.getChunk(
            x >> CHUNK_INC_SCL,
            y >> CHUNK_INC_SCL,
            z >> CHUNK_INC_SCL
        );
        chunk.set(
            x & BLOCK_POSITION_X_BITMASK,
            y & BLOCK_POSITION_Y_BITMASK,
            z & BLOCK_POSITION_Z_BITMASK,
            value
        );
    }
    public dispose(): void {
        let chunk;
        for(let i = 0; i < REGION_VOLUME; i++) {
            if((chunk = this.chunks[i]) == null) continue;
            chunk.dispose();
        }
    }
}

export class VoxelGrid {
    public regions: Map<string, VoxelGridRegion>;
    private cachedRegion: VoxelGridRegion;
    private cachedRegionX: number;
    private cachedRegionY: number;
    private cachedRegionZ: number;

    constructor() {
        this.regions = new Map;
        this.cachedRegion = null;
        this.cachedRegionX = Infinity;
        this.cachedRegionY = Infinity;
        this.cachedRegionZ = Infinity;
    }
    public getRegion(x: number, y: number, z: number): VoxelGridRegion {
        if(x === this.cachedRegionX && y === this.cachedRegionY && z === this.cachedRegionZ) return this.cachedRegion;
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
    public chunkExists(x: number, y: number, z: number): boolean {
        const region = this.getRegion(
            x >> REGION_INC_SCL,
            y >> REGION_INC_SCL,
            z >> REGION_INC_SCL
        );

        return region.chunkExists(
            x & CHUNK_POSITION_X_BITMASK,
            y & CHUNK_POSITION_Y_BITMASK,
            z & CHUNK_POSITION_Z_BITMASK
        );
    }
    public getChunk(x: number, y: number, z: number, create = true): VoxelGridChunk {
        const region = this.getRegion(
            x >> REGION_INC_SCL,
            y >> REGION_INC_SCL,
            z >> REGION_INC_SCL
        );

        return region.getChunk(
            x & CHUNK_POSITION_X_BITMASK,
            y & CHUNK_POSITION_Y_BITMASK,
            z & CHUNK_POSITION_Z_BITMASK,
            create
        );
    }
    public deleteChunk(x: number, y: number, z: number) {
        const region = this.getRegion(
            x >> REGION_INC_SCL,
            y >> REGION_INC_SCL,
            z >> REGION_INC_SCL
        );

        return region.deleteChunk(
            x & CHUNK_POSITION_X_BITMASK,
            y & CHUNK_POSITION_Y_BITMASK,
            z & CHUNK_POSITION_Z_BITMASK
        );
    }
    public get(x: number, y: number, z: number, createChunk = true): number {
        const region = this.getRegion(
            x >> REGION_BLOCK_INC,
            y >> REGION_BLOCK_INC,
            z >> REGION_BLOCK_INC
        );

        return region.get(
            x & CHUNK_POSITION_X_BITMASK,
            y & CHUNK_POSITION_Y_BITMASK,
            z & CHUNK_POSITION_Z_BITMASK,
            createChunk
        );
    }
    public set(x: number, y: number, z: number, value: number): void {
        const region = this.getRegion(
            x >> REGION_BLOCK_INC,
            y >> REGION_BLOCK_INC,
            z >> REGION_BLOCK_INC
        );

        region.set(
            x & REGION_BLOCK_POSITION_X_BITMASK,
            y & REGION_BLOCK_POSITION_Y_BITMASK,
            z & REGION_BLOCK_POSITION_Z_BITMASK,
            value
        );
    }
}