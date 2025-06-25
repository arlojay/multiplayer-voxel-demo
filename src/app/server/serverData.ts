import { loadObjectStoreIntoJson, openDb, saveJsonAsObjectStore, waitForTransaction } from "../serialization/dbUtils";
import { DatabaseView } from "./databaseView";
import { ServerPlugin } from "./serverPlugin";

export const SERVER_VERSION = 1;

export class ServerOptions {
    name: string = "server";
    plugins: string[] = new Array;
    defaultWorldName: string = "world";
}

export class WorldDescriptor {
    name: string;
    id: string = crypto.randomUUID();
    dateCreated = new Date;
    lastPlayed = new Date;
}

export class ServerData {
    public id: string;
    public db: IDBDatabase;
    public configDb: IDBDatabase;
    public worlds: Map<string, WorldDescriptor> = new Map;
    public options: ServerOptions;
    public pluginConfigs: Map<string, DatabaseView> = new Map;
    public pluginDatabases: Map<string, DatabaseView> = new Map;

    constructor(id: string, options: ServerOptions) {
        this.id = id;
        this.options = options;
    }
    public async open() {
        this.db = await openDb("servers/" + this.id, {
            version: SERVER_VERSION,
            upgrade(db, target) {
                console.log("Migrating server data " + this.id + " to v" + target);
                if(target == 1) {
                    db.createObjectStore("worlds", { keyPath: "name" });
                    db.createObjectStore("options", { keyPath: "name" });
                }
            },
        });
    }
    public close() {
        this.db.close();
    }

    public async saveOptions() {
        await saveJsonAsObjectStore(this.options, this.db.transaction("options", "readwrite").objectStore("options"), { packArrays: false })
    }
    public async loadOptions() {
        await loadObjectStoreIntoJson(this.options, this.db.transaction("options", "readonly").objectStore("options"))
    }

    public async createWorld(name: string) {
        const descriptor = new WorldDescriptor;
        descriptor.name = name;

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

        transaction.objectStore("worlds").delete(descriptor.name);
        console.log("Deleting world " + descriptor.name + " (" + descriptor.id + ")");

        try {
            await waitForTransaction(transaction);
        } catch(e) {
            throw new Error("Failed to delete world " + descriptor.id + " (" + descriptor.name + ")", { cause: e });
        }
        this.worlds.delete(descriptor.id);
        console.log("Finished deleting world");
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

    public async openPluginConfig(plugin: ServerPlugin | string) {
        const name = typeof plugin == "string" ? plugin : plugin.name;

        if(this.pluginConfigs.has(name)) {
            return this.pluginConfigs.get(name);
        }

        const config = new DatabaseView("servers/" + this.id + "/" + name + "/config");

        await config.open();
        this.pluginConfigs.set(name, config);
        return config;
    }

    public async openPluginDatabase(plugin: ServerPlugin | string) {
        const name = typeof plugin == "string" ? plugin : plugin.name;

        if(this.pluginConfigs.has(name)) {
            return this.pluginConfigs.get(name);
        }
        const config = new DatabaseView("servers/" + this.id + "/" + name + "/data");
        await config.open();
        this.pluginConfigs.set(name, config);
        return config;
    }

    public async loadAll() {
        await this.loadOptions();
        await this.loadWorlds();
    }
}