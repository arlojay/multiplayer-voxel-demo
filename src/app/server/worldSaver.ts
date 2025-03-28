import { debugLog } from "../logging";
import { VoxelGridChunk } from "../voxelGrid";
import { World } from "../world";

export const WORLD_VERSION = 1;

export function upgradeWorld(db: IDBDatabase, target: number) {
    if(target == 1) {
        db.createObjectStore("chunks", { keyPath: "position" });
    }
}

export class WorldSaver {
    public id: string;
    public db: IDBDatabase;
    public world: World;

    constructor(id: string, world: World) {
        this.id = id;
        this.world = world;
    }
    public async open() {
        const db = await new Promise<IDBDatabase>((res, rej) => {
            const request = indexedDB.open(this.id, WORLD_VERSION);
            request.addEventListener("success", () => {
                res(request.result);
            });
            request.addEventListener("error", (event: ErrorEvent) => {
                rej(new Error("Cannot open world database " + this.id, { cause: event.error ?? (event as any).target?.error }));
            });
            request.addEventListener("upgradeneeded", (event) => {
                debugLog("Migrate world " + this.id + " from " + event.oldVersion + " to " + event.newVersion);
                for(let version = event.oldVersion; version < event.newVersion; version++) {
                    upgradeWorld(request.result, version);
                }
            });
        });

        this.db = db;
    }

    public saveChunk(chunk: VoxelGridChunk) {

    }

    public saveAll() {
        return new Promise<void>((res, rej) => {
            for(const chunk of this.world.dirtyChunkQueue) {
                this.saveChunk(chunk);
            }
        });
    }
}