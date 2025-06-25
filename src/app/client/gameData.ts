import { ClientOptions } from "../controls/controlOptions";
import { deserializeControls, serializeControls } from "../controls/controlsMap";
import { loadObjectStoreIntoJson, openDb, saveJsonAsObjectStore, waitForTransaction } from "../serialization/dbUtils";

export const DATA_VERSION = 2;

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
        this.db = await openDb("mvd-data", {
            version: DATA_VERSION,
            upgrade(db: IDBDatabase, target: number) {
                console.log("Migrating game data to v" + target);

                if(target == 1) {
                    db.createObjectStore("worlds", { keyPath: "id", autoIncrement: true });
                    db.createObjectStore("options", { keyPath: "name" });
                }
                if(target == 2) {
                    db.createObjectStore("servers", { keyPath: "id" });
                    db.deleteObjectStore("worlds");
                }
            }
        })
    }


    public async saveClientOptions() {
        this.clientOptions.controls.keybinds = serializeControls();
        console.log(this.clientOptions.controls.keybinds);
        await saveJsonAsObjectStore(this.clientOptions, this.db.transaction("options", "readwrite").objectStore("options"), { packArrays: false })
    }
    public async loadClientOptions() {
        await loadObjectStoreIntoJson(this.clientOptions, this.db.transaction("options", "readonly").objectStore("options"))
        deserializeControls(this.clientOptions.controls.keybinds);
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

    public async deleteServer(id: string) {
        if(!this.servers.has(id)) throw new ReferenceError("No server with id " + id + " exists");

        const transaction = this.db.transaction("servers", "readwrite");

        transaction.objectStore("servers").delete(id);
        console.log("Deleting server " + id);

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to delete server " + id, { cause: e });
        }
        this.servers.delete(id);
        console.log("Finished deleting server");
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