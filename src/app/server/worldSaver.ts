import { BlockStateSaveKey } from "../block/blockState";
import { openDb, waitForTransaction } from "../serialization/dbUtils";
import { Chunk, World } from "../world/world";
import { Server } from "./server";

export const WORLD_VERSION = 1;
export const CURRENT_CHUNK_VERSION = 1;

export interface DatabaseChunk {
    position: [ number, number, number ],
    data: ArrayBuffer,
    palette: BlockStateSaveKey[],
    version: number
}

interface ChunkFetchRequest {
    x: number;
    y: number;
    z: number;
    resolver: PromiseWithResolvers<DatabaseChunk>
}

export class WorldSaver {
    public server: Server;
    public id: string;
    public db: IDBDatabase;
    public world: World;
    private chunkObjectStore: IDBObjectStore;
    private chunkFetchQueue: Set<ChunkFetchRequest> = new Set;
    private queueCheckInterval: any;

    constructor(server: Server, id: string, world: World) {
        this.server = server;
        this.id = id;
        this.world = world;
    }
    public async open() {
        this.db = await openDb("servers/" + this.server.id + "/worlds/" + this.id, {
            version: WORLD_VERSION,
            upgrade(db: IDBDatabase, target: number) {
                console.log("Migrating server world " + this.id + " to v" + target);
                if(target == 1) {
                    db.createObjectStore("data", { keyPath: "position" });
                }
            }
        })
        this.queueCheckInterval = setInterval(() => {
            this.updateChunkFetchQueue();
        }, 100);
    }

    public close() {
        this.db.close();
        clearInterval(this.queueCheckInterval);
    }

    private writeChunk(chunk: Chunk) {
        this.chunkObjectStore.put({
            position: [ chunk.x, chunk.y, chunk.z ],
            data: chunk.data.buffer,
            palette: chunk.flatPalette,
            version: CURRENT_CHUNK_VERSION
        } as DatabaseChunk);
    }

    private async updateChunkFetchQueue() {
        if(this.chunkFetchQueue.size === 0) return;
        
        const transaction = this.db.transaction("data", "readonly");
        const store = transaction.objectStore("data");
        
        const requests: any[] = new Array;

        for(const request of this.chunkFetchQueue) {
            const dbRequest = store.get([ request.x, request.y, request.z ]);
            requests.push({ base: request, dbRequest });
        }
        this.chunkFetchQueue.clear();
        
        try {
            await waitForTransaction(transaction);
            for(const request of requests) {
                request.base.resolver.resolve(request.dbRequest.result as DatabaseChunk);
            }
        } catch(e) {
            for(const request of requests) {
                request.base.resolver.reject(e);
            }
        }
    }

    public async getChunkData(x: number, y: number, z: number) {
        const instance = {
            x, y, z,
            resolver: Promise.withResolvers<DatabaseChunk>()
        };
        this.chunkFetchQueue.add(instance);
        try {
            return await instance.resolver.promise;
        } catch(e) {
            throw new Error("Failed to get chunk " + x + ", " + y + ", " + z, { cause: e });
        }
    }

    public async saveChunk(chunk: Chunk) {
        this.chunkObjectStore = this.db.transaction("data", "readwrite").objectStore("data");
        this.writeChunk(chunk);
        try {
            await waitForTransaction(this.chunkObjectStore.transaction);
        } catch(e) {
            throw new Error("Failed to write chunk " + chunk.x + "," + chunk.y + "," + chunk.z + " to disk", { cause: e })
        }
    }

    public async saveModified() {
        console.log("Saving world " + this.id);
        this.chunkObjectStore = this.db.transaction("data", "readwrite").objectStore("data");

        for(const chunk of this.world.dirtyChunkQueue) {
            this.writeChunk(chunk);
        }

        try {
            await waitForTransaction(this.chunkObjectStore.transaction);
        } catch(e) {
            throw new Error("Failed to write chunks to disk", { cause: e })
        }

        this.world.dirtyChunkQueue.clear();

        console.log("Saving world " + this.id + " complete");
    }
}