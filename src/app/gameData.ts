import { ClientOptions } from "./controlOptions";
import { loadObjectStoreIntoJson, saveJsonAsObjectStore, waitForTransaction } from "./dbUtils";
import { debugLog } from "./logging";

export const DATA_VERSION = 2;

export function upgradeData(db: IDBDatabase, target: number) {
    if(target == 1) {
        db.createObjectStore("worlds", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("options", { keyPath: "name" });
    }
    if(target == 2) {
        db.createObjectStore("servers", { keyPath: "id" });
        db.deleteObjectStore("worlds");
    }
}

export class ServerDescriptor {
    id: string = crypto.randomUUID();
    name: string;
    dateCreated = new Date;
    lastPlayed = new Date;
}

export class GameData {
    public db: IDBDatabase;
    public clientOptions = new ClientOptions;
    public servers: Map<string, ServerDescriptor> = new Map;
    
    
    public async open() {
        this.db = await new Promise<IDBDatabase>((res, rej) => {
            const request = indexedDB.open("mvd-data", DATA_VERSION);
            request.onsuccess = () => {
                res(request.result);
            };
            request.onerror = (event: ErrorEvent) => {
                rej(new Error("Cannot open game data database", { cause: event.error ?? (event as any).target?.error }));
            };
            request.onupgradeneeded = (event) => {
                debugLog("Migrate game data from v" + event.oldVersion + " to v" + event.newVersion);
                for(let version = event.oldVersion; version < event.newVersion; version++) {
                    upgradeData(request.result, version + 1);
                    debugLog("Migrated to v" + (version + 1));
                }
                debugLog("Migration of game data finished");
            };
        })
    }


    public async saveClientOptions() {
        await saveJsonAsObjectStore(this.clientOptions, this.db.transaction("options", "readwrite").objectStore("options"), { packArrays: false })
    }
    public async loadClientOptions() {
        await loadObjectStoreIntoJson(this.clientOptions, this.db.transaction("options", "readonly").objectStore("options"))
    }

    public async createServer(name: string) {
        const descriptor = new ServerDescriptor;
        descriptor.name = name;

        const transaction = this.db.transaction("servers", "readwrite");

        transaction.objectStore("servers").add(descriptor);

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to create server " + name, { cause: e });
        }

        this.servers.set(descriptor.id, descriptor);
        return descriptor;
    }

    public async updateServer(descriptor: ServerDescriptor) {
        if(!this.servers.has(descriptor.id)) throw new ReferenceError("No server with id " + descriptor.id + " exists");

        const transaction = this.db.transaction("servers", "readwrite");

        transaction.objectStore("servers").put(descriptor);

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to update server " + descriptor.id + " (" + descriptor.name + ")", { cause: e });
        }
    }

    public async deleteServer(descriptor: ServerDescriptor) {
        if(!this.servers.has(descriptor.id)) throw new ReferenceError("No server with id " + descriptor.id + " exists");

        const transaction = this.db.transaction("servers", "readwrite");

        transaction.objectStore("servers").delete(descriptor.id);
        debugLog("Deleting server " + descriptor.name + " (" + descriptor.id + ")");

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to delete server " + descriptor.id + " (" + descriptor.name + ")", { cause: e });
        }
        this.servers.delete(descriptor.id);
        debugLog("Finished deleting server");
    }

    public async loadServers() {
        const transaction = this.db.transaction("servers", "readonly");
        const request = transaction.objectStore("servers").getAll();

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to load server descriptors", { cause: e });
        }
        
        this.servers.clear();
        for(const prop of request.result) {
            this.servers.set(prop.id, prop);
        }
    }

    public async loadAll() {
        await this.loadClientOptions();
        await this.loadServers();
    }
    public async saveAll() {
        await this.saveClientOptions();
    }
}