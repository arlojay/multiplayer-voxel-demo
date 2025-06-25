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

export class WorldSaver {
    public server: Server;
    public id: string;
    public db: IDBDatabase;
    public world: World;
    chunkObjectStore: IDBObjectStore;

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
    }

    private writeChunk(chunk: Chunk) {
        this.chunkObjectStore.put({
            position: [ chunk.x, chunk.y, chunk.z ],
            data: chunk.data.buffer,
            palette: chunk.flatPalette,
            version: CURRENT_CHUNK_VERSION
        } as DatabaseChunk);
    }

    public async getChunkData(x: number, y: number, z: number) {
        const transaction = this.db.transaction("data", "readonly");
        const request = transaction.objectStore("data").get([ x, y, z ]);
        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to get chunk " + x + ", " + y + ", " + z, { cause: e });
        }
        return request.result;
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