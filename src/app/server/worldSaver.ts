import { debugLog } from "../logging";
import { VoxelGridChunk } from "../voxelGrid";
import { World } from "../world";

export const WORLD_VERSION = 1;

export function upgradeWorld(db: IDBDatabase, target: number) {
    if(target == 1) {
        db.createObjectStore("data", { keyPath: "position" });
    }
}

export class WorldSaver {
    public name: string;
    public db: IDBDatabase;
    public world: World;
    chunkObjectStore: IDBObjectStore;

    constructor(id: string, world: World) {
        this.name = id;
        this.world = world;
    }
    public async open() {
        this.db = await new Promise<IDBDatabase>((res, rej) => {
            const request = indexedDB.open("world/" + this.name, WORLD_VERSION);
            request.onsuccess = () => {
                res(request.result);
            };
            request.onerror = (event: ErrorEvent) => {
                rej(new Error("Cannot open world database " + this.name, { cause: event.error ?? (event as any).target?.error }));
            };
            request.onupgradeneeded = (event) => {
                debugLog("Migrate world " + this.name + " from v" + event.oldVersion + " to v" + event.newVersion);
                for(let version = event.oldVersion; version <= event.newVersion; version++) {
                    upgradeWorld(request.result, version);
                    debugLog("Migrated " + this.name + " to v" + version);
                }
                debugLog("Migration of world "  + this.name + " finished");
            };
        });
    }

    private writeChunk(chunk: VoxelGridChunk) {
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

    public saveChunk(chunk: VoxelGridChunk) {
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
        console.log("Saving world " + this.name);
        await Promise.all([
            new Promise<void>((res, rej) => {
                this.chunkObjectStore ??= this.db.transaction("data", "readwrite").objectStore("data");

                for(const chunk of this.world.dirtyChunkQueue) {
                    this.writeChunk(chunk);
                }
    
                this.chunkObjectStore.transaction.oncomplete = () => {
                    this.world.dirtyChunkQueue.clear();
                    console.log("Done saving chunks for " + this.name);
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
        console.log("Saving world " + this.name + " complete");
    }
}