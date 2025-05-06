import { loadObjectStoreIntoJson, saveJsonAsObjectStore, waitForTransaction } from "../dbUtils";
import { debugLog } from "../logging";

export const SERVER_VERSION = 1;

export function upgradeServer(db: IDBDatabase, target: number) {
    if(target == 1) {
        db.createObjectStore("worlds", { keyPath: "name" });
        db.createObjectStore("options", { keyPath: "name" });
    }
}

export interface ServerOptions {
    name: string;
    plugins: string[];
    defaultWorldName: string;
}

export interface WorldDescriptor {
    id?: string;
    name: string;
    location: string;
    dateCreated: Date;
    lastPlayed: Date;
}

export class ServerData {
    public id: string;
    public db: IDBDatabase;
    public worlds: Map<string, WorldDescriptor> = new Map;
    public options: ServerOptions;

    constructor(id: string, options: ServerOptions) {
        this.id = id;
        this.options = options;
    }
    public async open() {
        this.db = await new Promise<IDBDatabase>((res, rej) => {
            const request = indexedDB.open("servers/" + this.id, SERVER_VERSION);
            request.onsuccess = () => {
                res(request.result);
            };
            request.onerror = (event: ErrorEvent) => {
                rej(new Error("Cannot open server database " + this.id, { cause: event.error ?? (event as any).target?.error }));
            };
            request.onupgradeneeded = (event) => {
                debugLog("Migrate server " + this.id + " from v" + event.oldVersion + " to v" + event.newVersion);
                for(let version = event.oldVersion; version <= event.newVersion; version++) {
                    upgradeServer(request.result, version);
                    debugLog("Migrated " + this.id + " to v" + version);
                }
                debugLog("Migration of server "  + this.id + " finished");
            };
        });
    }

    public async saveOptions() {
        await saveJsonAsObjectStore(this.options, this.db.transaction("options", "readonly").objectStore("options"))
    }
    public async loadOptions() {
        await loadObjectStoreIntoJson(this.options, this.db.transaction("options", "readonly").objectStore("options"))
    }

    public async createWorld(name: string) {
        const descriptor: WorldDescriptor = {
            name, location: crypto.randomUUID(),
            dateCreated: new Date,
            lastPlayed: new Date
        };

        const transaction = this.db.transaction("worlds", "readwrite");

        transaction.objectStore("worlds").add(descriptor);

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to create world " + name, { cause: e });
        }
        return descriptor;
    }

    public async updateWorld(descriptor: WorldDescriptor) {
        if(!this.worlds.has(descriptor.id)) throw new ReferenceError("No world with id " + descriptor.id + " exists");

        const transaction = this.db.transaction("worlds", "readwrite");

        transaction.objectStore("worlds").put(descriptor);

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to update world " + descriptor.id + " (" + descriptor.name + ")", { cause: e });
        }
    }

    public async deleteWorld(descriptor: WorldDescriptor) {
        if(!this.worlds.has(descriptor.id)) throw new ReferenceError("No world with id " + descriptor.id + " exists");

        const transaction = this.db.transaction("worlds", "readwrite");

        transaction.objectStore("worlds").delete(descriptor.location);
        debugLog("Deleting world " + descriptor.name + " (" + descriptor.id + ")");

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to delete world " + descriptor.id + " (" + descriptor.name + ")", { cause: e });
        }
        this.worlds.delete(descriptor.id);
        debugLog("Finished deleting world");
    }

    public async loadWorlds() {
        const transaction = this.db.transaction("worlds", "readonly");
        const request = transaction.objectStore("worlds").getAll();

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to load world descriptors", { cause: e });
        }
        
        this.worlds.clear();
        for(const worldDescriptor of request.result) {
            this.worlds.set(worldDescriptor.name, worldDescriptor);
        }
    }

    public async loadAll() {
        await this.loadOptions();
        await this.loadWorlds();
    }
}