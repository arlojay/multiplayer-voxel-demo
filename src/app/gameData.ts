import { ClientOptions } from "./controlOptions";
import { flatPack, inflate } from "./flatPackedObject";
import { debugLog } from "./logging";

export const DATA_VERSION = 1;

export function upgradeData(db: IDBDatabase, target: number) {
    if(target == 1) {
        db.createObjectStore("worlds", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("options", { keyPath: "name" });
    }
}

export interface WorldDescriptor {
    id?: number;
    name: string;
    location: string;
    dateCreated: Date;
    lastPlayed: Date;
}

export class GameData {
    public db: IDBDatabase;
    public clientOptions: ClientOptions = {
        controls: {
            mouseSensitivity: 0.3,
            invertY: false
        },
        customization: {
            username: "player-" + Math.random().toString().slice(2),
            color: "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")
        },
        viewDistance: 4
    };
    public worlds: Map<number, WorldDescriptor> = new Map;
    
    
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
                for(let version = event.oldVersion; version <= event.newVersion; version++) {
                    upgradeData(request.result, version);
                    debugLog("Migrated to v" + version);
                }
                debugLog("Migration of game data finished");
            };
        })
    }

    private waitForTransaction(transaction: IDBTransaction) {
        return new Promise<void>((res, rej) => {
            transaction.oncomplete = () => {
                res();
            }
            transaction.onerror = (e: ErrorEvent) => {
                rej(new Error("Failed to finish transaction", { cause: e.error }));
            }
            transaction.onabort = () => {
                rej(new Error("Aborted while completing transaction"));
            }
        })
    }

    public async saveClientOptions() {
        const transaction = this.db.transaction("options", "readwrite");
        const packed = flatPack(this.clientOptions);

        for(const key in packed) {
            transaction.objectStore("options").put({
                name: key,
                value: packed[key]
            })
        }

        try {
            await this.waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to save client options", { cause: e });
        }
    }

    public async loadClientOptions() {
        const transaction = this.db.transaction("options", "readonly");
        const request = transaction.objectStore("options").getAll();

        try {
            await this.waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to load client options", { cause: e });
        }
        
        const packed: Record<string, any> = flatPack(this.clientOptions); // use current clientoptions as default
        for(const prop of request.result) {
            packed[prop.name] = prop.value;
        }
        const options = inflate(packed);
        this.clientOptions = options;
    }

    public async createWorld(name: string, databaseName: string) {
        const descriptor: WorldDescriptor = {
            name, location: databaseName,
            dateCreated: new Date,
            lastPlayed: new Date
        };

        const transaction = this.db.transaction("worlds", "readwrite");

        transaction.objectStore("worlds").add(descriptor)

        try {
            await this.waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to create world " + name, { cause: e });
        }
    }

    public async updateWorld(descriptor: WorldDescriptor) {
        if(!this.worlds.has(descriptor.id)) throw new ReferenceError("No world with id " + descriptor.id + " exists");

        const transaction = this.db.transaction("worlds", "readwrite");

        transaction.objectStore("worlds").put(descriptor);

        try {
            await this.waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to update world " + descriptor.id + " (" + descriptor.name + ")", { cause: e });
        }
    }

    public async deleteWorld(descriptor: WorldDescriptor) {
        if(!this.worlds.has(descriptor.id)) throw new ReferenceError("No world with id " + descriptor.id + " exists");

        const transaction = this.db.transaction("worlds", "readwrite");

        transaction.objectStore("worlds").delete(descriptor.id);
        debugLog("Deleting world " + descriptor.name + " (" + descriptor.id + ")");

        try {
            await this.waitForTransaction(transaction);
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
            await this.waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to load world descriptors", { cause: e });
        }
        
        this.worlds.clear();
        for(const prop of request.result) {
            this.worlds.set(prop.id, prop);
        }
    }

    public async setPlayerUsername(username: string) {

    }
    public async setPlayerColor(color: string) {
        
    }

    public async loadAll() {
        await this.loadClientOptions();
        await this.loadWorlds();
    }
    public async saveAll() {
        await this.saveClientOptions();
    }
}