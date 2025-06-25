import { Color, Mesh } from "three";
import { BlockDataMemoizer } from "../block/blockDataMemoizer";
import { BlockRegistry } from "../block/blockRegistry";
import { BlockState, BlockStateSaveKey, BlockStateSaveKeyPair, blockStateSaveKeyPairToString, blockStateSaveKeyToPair } from "../block/blockState";
import { BaseEntity, EntityLogicType } from "../entity/baseEntity";
import { Server } from "../server/server";
import { EntityGrid, EntityGridChunk } from "./entityGrid";
import { BLOCK_POSITION_X_BITMASK, BLOCK_POSITION_Y_BITMASK, BLOCK_POSITION_Z_BITMASK, CHUNK_BLOCK_INC_BYTE, CHUNK_INC_SCL, VoxelGrid, VoxelGridChunk } from "./voxelGrid";
import { WorldGenerator } from "./worldGenerator";
import { WorldRaycaster } from "./worldRaycaster";

export type ColorType = Color | number | null;

export class Chunk {
    public readonly world: World;
    public readonly voxelChunk: VoxelGridChunk;
    public readonly entityChunk: EntityGridChunk;
    public readonly x: number;
    public readonly y: number;
    public readonly z: number;
    public readonly blockX: number;
    public readonly blockY: number;
    public readonly blockZ: number;
    public mesh: Mesh | null;

    public readonly surroundedChunks: boolean[] = new Array(27).fill(false);
    private surroundings = 0;
    public palette: Map<BlockStateSaveKey, number> = new Map();
    public flatPalette: BlockStateSaveKey[] = new Array;
    public flatPalettePairs: BlockStateSaveKeyPair[] = new Array;
    public memoizedIds: number[] = new Array;

    constructor(world: World, voxelChunk: VoxelGridChunk, entityChunk: EntityGridChunk) {
        this.world = world
        this.voxelChunk = voxelChunk;
        this.entityChunk = entityChunk;
        this.x = voxelChunk.x;
        this.y = voxelChunk.y;
        this.z = voxelChunk.z;
        this.blockX = voxelChunk.x << CHUNK_INC_SCL;
        this.blockY = voxelChunk.y << CHUNK_INC_SCL;
        this.blockZ = voxelChunk.z << CHUNK_INC_SCL;
    }

    public getHomogeneousBlock() {
        const data = this.voxelChunk.data;
        const comparison = data[0];
        for(let i = 0; i < data.length; i++) {
            if(data[i] != comparison) return -1;
        }
        return comparison;
    }

    public getBlockStateKey(x: number, y: number, z: number): BlockStateSaveKey {
        const id = this.voxelChunk.get(x, y, z);
        return this.flatPalette[id];
    }
    public getBlockStateKeyPair(x: number, y: number, z: number): BlockStateSaveKeyPair {
        const id = this.voxelChunk.get(x, y, z);
        return this.flatPalettePairs[id];
    }
    public getBlockStateAsMemoizedId(x: number, y: number, z: number) {
        return this.memoizedIds[this.voxelChunk.get(x & BLOCK_POSITION_X_BITMASK, y & BLOCK_POSITION_Y_BITMASK, z & BLOCK_POSITION_Z_BITMASK)];
    }
    public getBlockState(x: number, y: number, z: number, blockRegistry: BlockRegistry, blockState?: BlockState): BlockState {
        const id = this.voxelChunk.get(x, y, z);
        const statePair = this.flatPalettePairs[id];

        if(statePair == null) {
            console.warn("Unknown block " + id + " at " + (x + this.blockX) + ", " + (y + this.blockY) + ", " + (z + this.blockZ), this.flatPalette);
            return null;
        }

        x += this.blockX;
        y += this.blockY;
        z += this.blockZ;

        const block = blockRegistry.get(statePair[0]);
        if(blockState != null) {
            blockState.block = block;
            blockState.world = this.world;
            blockState.state = statePair[1];
            blockState.x = x;
            blockState.y = y;
            blockState.z = z;
            return blockState;
        }
        return new BlockState(block, this.world, statePair[1], x, y, z);
    }
    public setBlockState(x: number, y: number, z: number, block: BlockStateSaveKey) {
        const id = this.getPaletteId(block);
        this.voxelChunk.set(x, y, z, id);
    }

    public get data() {
        return this.voxelChunk.data;
    }
    public get entities() {
        return this.entityChunk.entities;
    }

    private getPaletteId(stateKey: BlockStateSaveKey) {
        if(this.palette.has(stateKey)) return this.palette.get(stateKey);
        const index = this.getNextFreePaletteIndex();
        this.palette.set(stateKey, index);
        this.flatPalette[index] = stateKey;
        this.flatPalettePairs[index] = blockStateSaveKeyToPair(stateKey);
        this.memoizedIds[index] = this.world.memoizer.getMemoizedId(stateKey);
        
        return index;
    }
    private getNextFreePaletteIndex() {
        let i = 0;
        while(this.flatPalette[i] != null) i++;
        return i;
    }

    public cleanPalette() {
        const usedStateIds: Set<BlockStateSaveKey> = new Set;
        
        for(let i = 0; i < this.data.length; i++) {
            const pair = this.flatPalette[this.data[i]];
            usedStateIds.add(pair);
        }

        for(const saveKey of this.palette.keys()) {
            if(!usedStateIds.has(saveKey)) {
                const paletteIndex = this.palette.get(saveKey);
                this.palette.delete(saveKey);
                this.flatPalette[paletteIndex] = null;
                this.flatPalettePairs[paletteIndex] = null;
                this.memoizedIds[paletteIndex] = null;
            }
        }
    }

    public setPalette(flatPalette: (BlockStateSaveKey | null)[]) {
        if(flatPalette.length === 0) flatPalette.push("air#default");

        this.palette.clear();
        this.flatPalette = flatPalette ?? [];
        this.flatPalettePairs.splice(0);
        this.memoizedIds.splice(0);

        for(const [ index, fullStateId ] of flatPalette.entries()) {
            if(fullStateId == null) continue;

            this.palette.set(fullStateId, index);
            this.flatPalettePairs[index] = blockStateSaveKeyToPair(fullStateId);
            this.memoizedIds[index] = this.world.memoizer.getMemoizedId(fullStateId);
        }
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
        const i = (dx + 1) * 9 + (dy + 1) * 3 + (dz + 1);
        if(!this.surroundedChunks[i]) {
            this.surroundedChunks[i] = true;
            this.surroundings++;
        }
    }

    public isFullySurrounded() {
        return this.surroundings === 26;
    }
}

export class World {
    public server: Server = null;
    public blocks: VoxelGrid = new VoxelGrid;
    public raycaster: WorldRaycaster;
    public entities: EntityGrid = new EntityGrid;
    public dirtyChunkQueue: Set<Chunk> = new Set;
    public id: string;
    public generator: WorldGenerator;

    public chunkMap: WeakMap<VoxelGridChunk, Chunk> = new Map;
    public blockRegistry: BlockRegistry;
    public memoizer: BlockDataMemoizer;

    public constructor(id: string, memoizer: BlockDataMemoizer, server?: Server) {
        this.id = id;
        this.server = server;

        this.memoizer = memoizer;
        this.blockRegistry = memoizer.blockRegistry;
        this.raycaster = new WorldRaycaster(this);
    }

    public setBlockState(x: number, y: number, z: number, state: BlockState, update = true) {
        const chunk = this.getChunk(x >> CHUNK_BLOCK_INC_BYTE, y >> CHUNK_BLOCK_INC_BYTE, z >> CHUNK_BLOCK_INC_BYTE);

        const blockX = (x & BLOCK_POSITION_X_BITMASK);
        const blockY = (y & BLOCK_POSITION_Y_BITMASK);
        const blockZ = (z & BLOCK_POSITION_Z_BITMASK);

        if(chunk == null) return;
        
        chunk.setBlockState(blockX, blockY, blockZ, state.getSaveKey());

        if(update) this.updateBlock(x, y, z, chunk);
    }
    public setBlockStateKey(x: number, y: number, z: number, key: BlockStateSaveKey | BlockStateSaveKeyPair, update = true) {
        const chunk = this.getChunk(x >> CHUNK_BLOCK_INC_BYTE, y >> CHUNK_BLOCK_INC_BYTE, z >> CHUNK_BLOCK_INC_BYTE);

        const blockX = (x & BLOCK_POSITION_X_BITMASK);
        const blockY = (y & BLOCK_POSITION_Y_BITMASK);
        const blockZ = (z & BLOCK_POSITION_Z_BITMASK);

        if(chunk == null) return;
        
        chunk.setBlockState(blockX, blockY, blockZ, typeof key === "string" ? key : blockStateSaveKeyPairToString(key));

        if(update) this.updateBlock(x, y, z, chunk);
    }

    public getBlockState(x: number, y: number, z: number, blockState?: BlockState) {
        const chunk = this.getChunk(x >> CHUNK_BLOCK_INC_BYTE, y >> CHUNK_BLOCK_INC_BYTE, z >> CHUNK_BLOCK_INC_BYTE);

        const blockX = (x & BLOCK_POSITION_X_BITMASK);
        const blockY = (y & BLOCK_POSITION_Y_BITMASK);
        const blockZ = (z & BLOCK_POSITION_Z_BITMASK);

        if(chunk == null) return null;
        
        return chunk.getBlockState(blockX, blockY, blockZ, this.blockRegistry, blockState);
    }

    public getBlockStateKey(x: number, y: number, z: number) {
        const chunk = this.getChunk(x >> CHUNK_BLOCK_INC_BYTE, y >> CHUNK_BLOCK_INC_BYTE, z >> CHUNK_BLOCK_INC_BYTE);

        const blockX = (x & BLOCK_POSITION_X_BITMASK);
        const blockY = (y & BLOCK_POSITION_Y_BITMASK);
        const blockZ = (z & BLOCK_POSITION_Z_BITMASK);

        if(chunk == null) return null;
        
        return chunk.getBlockStateKey(blockX, blockY, blockZ);
    }

    public getBlockStateAsMemoizedId(x: number, y: number, z: number) {
        const chunk = this.getChunk(x >> CHUNK_BLOCK_INC_BYTE, y >> CHUNK_BLOCK_INC_BYTE, z >> CHUNK_BLOCK_INC_BYTE);

        if(chunk == null) return 0;

        const blockX = (x & BLOCK_POSITION_X_BITMASK);
        const blockY = (y & BLOCK_POSITION_Y_BITMASK);
        const blockZ = (z & BLOCK_POSITION_Z_BITMASK);
        
        return chunk.getBlockStateAsMemoizedId(blockX, blockY, blockZ);
    }

    public updateBlock(x: number, y: number, z: number, chunk: Chunk) {
        const chunkX = x >> CHUNK_BLOCK_INC_BYTE;
        const chunkY = y >> CHUNK_BLOCK_INC_BYTE;
        const chunkZ = z >> CHUNK_BLOCK_INC_BYTE;

        const blockX = (x & BLOCK_POSITION_X_BITMASK);
        const blockY = (y & BLOCK_POSITION_Y_BITMASK);
        const blockZ = (z & BLOCK_POSITION_Z_BITMASK);

        this.markChunkDirty(chunk);

        for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
                for(let dz = -1; dz <= 1; dz++) {
                    if(
                        (blockX === 15 ? 1 : (blockX === 0 ? -1 : 0)) === dx ||
                        (blockY === 15 ? 1 : (blockY === 0 ? -1 : 0)) === dy ||
                        (blockZ === 15 ? 1 : (blockZ === 0 ? -1 : 0)) === dz
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
            chunk = new Chunk(this, voxelChunk, this.entities.getChunk(x, y, z));
            this.chunkMap.set(voxelChunk, chunk);
        }

        return chunk;
    }

    public deleteChunk(x: number, y: number, z: number) {
        const chunk = this.blocks.deleteChunk(x, y, z);
        this.chunkMap.delete(chunk);
        chunk.dispose();
    }
    
    public setGenerator(generator: WorldGenerator) {
        this.generator = generator;
    }
    private warnedAboutNullGenerator = false;
    public generateChunk(chunk: Chunk) {
        chunk.setPalette(["air#default"]);
        if(this.generator == null) {
            if(!this.warnedAboutNullGenerator) {
                console.warn("Generator is null for world " + this.id + "; generating empty chunks");
                this.warnedAboutNullGenerator = true;
            }
            return chunk;
        }
        return this.generator.generateChunk(chunk);
    }

    public update(dt: number) {
        for(const entity of this.entities.allEntities.values()) {
            entity.update(dt);
        }
    }
    public addEntity(entity: BaseEntity) {
        entity.setWorld(this);
        this.entities.addEntity(entity);
    }
    public spawnEntity<T extends BaseEntity>(EntityClass: new (logicType: EntityLogicType) => T) {
        const entity = new EntityClass(EntityLogicType.LOCAL_LOGIC);
        this.addEntity(entity);
        if(this.server != null) {
            entity.server = this.server;
            this.server.spawnEntity(entity);
        }
        return entity;
    }
    public removeEntity(entity: BaseEntity) {
        this.entities.removeEntity(entity);
        entity.remoteLogic?.onRemove();
        entity.setWorld(null);
        
        if(this.server != null) {
            this.server.removeEntity(entity);
        }
    }
    public getEntityByUUID(uuid: string) {
        return this.entities.allEntities.get(uuid);
    }
}