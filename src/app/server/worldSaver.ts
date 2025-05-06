import { debugLog } from "../logging";
import { Chunk, World } from "../world";
import { Server } from "./server";

export const WORLD_VERSION = 1;

export function upgradeWorld(db: IDBDatabase, target: number) {
    if(target == 1) {
        db.createObjectStore("data", { keyPath: "position" });
    }
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
        this.db = await new Promise<IDBDatabase>((res, rej) => {
            const request = indexedDB.open("world/" + this.server.id + "/" + this.id, WORLD_VERSION);
            request.onsuccess = () => {
                res(request.result);
            };
            request.onerror = (event: ErrorEvent) => {
                rej(new Error("Cannot open world database " + this.id, { cause: event.error ?? (event as any).target?.error }));
            };
            request.onupgradeneeded = (event) => {
                debugLog("Migrate world " + this.id + " from v" + event.oldVersion + " to v" + event.newVersion);
                for(let version = event.oldVersion; version <= event.newVersion; version++) {
                    upgradeWorld(request.result, version);
                    debugLog("Migrated " + this.id + " to v" + version);
                }
                debugLog("Migration of world "  + this.id + " finished");
            };
        });
    }

    private writeChunk(chunk: Chunk) {
        this.chunkObjectStore.put({
            position: [ chunk.x, chunk.y, chunk.z ],
            data: chunk.data.buffer
        });
    }

    public getChunkData(x: number, y: number, z: number) {
        return new Promise<ArrayBuffer>((res, rej) => {
            const store = this.db.transaction("data", "readonly").objectStore("data");
            const request = store.get([ x, y, z ]);

            store.transaction.oncomplete = () => {
                res(request.result?.data);
            }
            store.transaction.onerror = (e: ErrorEvent) => {
                rej(new Error("Failed to get chunk " + x + ", " + y + ", " + z, { cause: e.error }));
            }
            store.transaction.onabort = () => {
                rej(new Error("Aborted while getting chunk " + x + ", " + y + ", " + z));
            }
        });
    }

    public saveChunk(chunk: Chunk) {
        return new Promise<void>((res, rej) => {
            this.chunkObjectStore ??= this.db.transaction("data", "readwrite").objectStore("data");

            this.writeChunk(chunk);

            this.chunkObjectStore.transaction.oncomplete = () => {
                res();
            }
            this.chunkObjectStore.transaction.onerror = (e: ErrorEvent) => {
                rej(new Error("Failed to write chunk " + chunk.x + "," + chunk.y + "," + chunk.z + " to disk", { cause: e.error }));
            }
            this.chunkObjectStore.transaction.onabort = () => {
                rej(new Error("Aborted while writing chunk " + chunk.x + "," + chunk.y + "," + chunk.z + " to disk"));
            }
            this.chunkObjectStore = null;
        })
    }

    public async saveModified() {
        debugLog("Saving world " + this.id);
        await Promise.all([
            new Promise<void>((res, rej) => {
                this.chunkObjectStore ??= this.db.transaction("data", "readwrite").objectStore("data");

                for(const chunk of this.world.dirtyChunkQueue) {
                    this.writeChunk(chunk);
                }
    
                this.chunkObjectStore.transaction.oncomplete = () => {
                    this.world.dirtyChunkQueue.clear();
                    debugLog("Done saving chunks for " + this.id);
                    res();
                }
                this.chunkObjectStore.transaction.onerror = (e: ErrorEvent) => {
                    rej(new Error("Failed to write chunks to disk", { cause: (e.target as IDBRequest).error }));
                }
                this.chunkObjectStore.transaction.onabort = () => {
                    rej(new Error("Aborted while writing chunks to disk"));
                }
                this.chunkObjectStore = null;
            })
        ]);
        debugLog("Saving world " + this.id + " complete");
    }
}