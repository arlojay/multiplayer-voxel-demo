import { BaseEntity } from "../entity/baseEntity";
import { CHUNK_SIZE, CHUNK_X_INC_BYTE, CHUNK_Y_INC_BYTE, CHUNK_Z_INC_BYTE, REGION_INC_SCL, REGION_SIZE } from "./voxelGrid";

export class EntityGridChunk {
    entities: Set<BaseEntity> = new Set;
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

export class EntityGridRegion {
    chunks: EntityGridChunk[];
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
        this.chunks = new Array(CHUNK_SIZE ** 3);
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public chunkExists(x: number, y: number, z: number): boolean {
        return this.chunks[x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE] != null;
    }
    public getChunk(x: number, y: number, z: number, create = true): EntityGridChunk {
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
    public createChunk(x: number, y: number, z: number): EntityGridChunk {
        return this.chunks[x << CHUNK_X_INC_BYTE | y << CHUNK_Y_INC_BYTE | z << CHUNK_Z_INC_BYTE] = new EntityGridChunk(x + this.x * REGION_SIZE, y + this.y * REGION_SIZE, z + this.z * REGION_SIZE);
    }
}

export class EntityGrid {
    public allEntities: Map<string, BaseEntity> = new Map;
    public regions: Map<string, EntityGridRegion>;
    private entityChunks: Map<BaseEntity, EntityGridChunk> = new Map;
    private cachedRegion: EntityGridRegion;
    private cachedRegionX: number;
    private cachedRegionY: number;
    private cachedRegionZ: number;

    public constructor() {
        this.regions = new Map;
        this.cachedRegion = null;
        this.cachedRegionX = Infinity;
        this.cachedRegionY = Infinity;
        this.cachedRegionZ = Infinity;
    }
    public getRegion(x: number, y: number, z: number): EntityGridRegion {
        if(x == this.cachedRegionX && y == this.cachedRegionY && z == this.cachedRegionZ) return this.cachedRegion;
        this.cachedRegionX = x;
        this.cachedRegionY = y;
        this.cachedRegionZ = z;
        const key = x + "," + y + "," + z;
        let cachedRegion = this.regions.get(key);
        if(cachedRegion == null) {
            cachedRegion = new EntityGridRegion(x, y, z);
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
            x - (x >> REGION_INC_SCL << REGION_INC_SCL),
            y - (y >> REGION_INC_SCL << REGION_INC_SCL),
            z - (z >> REGION_INC_SCL << REGION_INC_SCL)
        );
    }
    public getChunk(x: number, y: number, z: number, create = true): EntityGridChunk {
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
    public deleteChunk(x: number, y: number, z: number) {
        const region = this.getRegion(
            x >> REGION_INC_SCL,
            y >> REGION_INC_SCL,
            z >> REGION_INC_SCL
        );

        return region.deleteChunk(
            x - (x >> REGION_INC_SCL << REGION_INC_SCL),
            y - (y >> REGION_INC_SCL << REGION_INC_SCL),
            z - (z >> REGION_INC_SCL << REGION_INC_SCL)
        );
    }

    public addEntity(entity: BaseEntity) {
        if(this.allEntities.has(entity.uuid)) throw new ReferenceError("Entity with uuid " + entity.uuid + " already exists");
        this.allEntities.set(entity.uuid, entity);
        this.updateEntityLocation(entity);
    }
    public removeEntity(entity: BaseEntity) {
        this.allEntities.delete(entity.uuid);
        const chunk = this.entityChunks.get(entity);
        if(chunk != null) {
            chunk.entities.delete(entity);
        }
    }
    public getEntityChunk(entity: BaseEntity) {
        return this.entityChunks.get(entity);
    }

    public updateEntityLocation(entity: BaseEntity) {
        const { chunkX, chunkY, chunkZ } = entity;

        const oldChunk = this.entityChunks.get(entity);
        if(oldChunk != null && oldChunk.x == chunkX && oldChunk.y == chunkY && oldChunk.z == chunkZ) return;

        const chunk = this.getChunk(chunkX, chunkY, chunkZ, true);
        if(oldChunk != null) {
            oldChunk.entities.delete(entity);
        }
        chunk.entities.add(entity);
        this.entityChunks.set(entity, chunk);
    }
    public *[Symbol.iterator]() {
        yield* this.allEntities.values();
    }
}