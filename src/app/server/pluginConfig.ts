import { waitForTransaction } from "../dbUtils";
import { inflate } from "../flatPackedObject";
import { ServerData } from "./serverData";

export class PluginObjectStore<Schema> {
    public data: Schema;

    private db: IDBDatabase;
    public pluginConfig: PluginConfig;
    public name: string;

    public constructor(db: IDBDatabase, pluginConfig: PluginConfig, name: string) {
        this.db = db;
        this.pluginConfig = pluginConfig;
        this.name = name;
    }

    private async set(path: string, value: any) {
        const transaction = this.db.transaction(this.name);
        transaction.objectStore(this.name).put(path, value);
        await waitForTransaction(transaction);
    }

    private async delete(path: string) {
        const transaction = this.db.transaction(this.name);
        transaction.objectStore(this.name).delete(path);
        await waitForTransaction(transaction);
    }

    private proxyProperty(object: any, path: string[]) {
        return new Proxy(object, {
            get: (target, p: string, receiver) => {
                const prop = Reflect.get(target, p, receiver);
                if(typeof prop == "object") {
                    return this.proxyProperty(prop, path.concat([p]));
                } else {
                    return prop;
                }
            },
            set: (target, p: string, newValue, receiver) => {
                const success = Reflect.set(target, p, newValue, receiver);
                if(success) this.set(path.join(".") + "." + p, newValue);

                return success;
            },
            deleteProperty: (target, p: string) => {
                const success = Reflect.deleteProperty(target, p);
                if(success) this.delete(path.join(".") + "." + p);

                return success;
            },
        });
    }

    public async open() {
        if(!this.db.objectStoreNames.contains(this.name)) {
            await this.pluginConfig.createIDBObjectStores(this.name);
        }

        const transaction = this.db.transaction(this.name, "readonly");
        const allKeys = transaction.objectStore(this.name).getAll();

        await waitForTransaction(transaction);
        this.data = this.proxyProperty(inflate(allKeys.result), []);
    }

    public setIDBDatabase(db: IDBDatabase) {
        this.db = db;
    }
}

export class PluginConfig {
    public name: string;
    public serverData: ServerData;
    private db: IDBDatabase;
    private stores: Map<string, PluginObjectStore<any>>;

    constructor(serverData: ServerData, name: string) {
        this.serverData = serverData;
        this.name = name;
    }

    public async open() {
        this.setDb(await this.openDb());
    }

    private async openDb(upgradeHandler?: (db: IDBDatabase) => void) {
        const descriptor = await indexedDB.databases().then(dbs => dbs.find(db => db.name == this.name));
        let version = descriptor.version ?? 1;
        if(upgradeHandler != null) version++;

        return await new Promise<IDBDatabase>((res, rej) => {
            const request = indexedDB.open("servers/" + this.serverData.id + "/config/" + this.name, version);
            request.onsuccess = () => res(request.result);

            request.onerror = (event: ErrorEvent) => {
                rej(new Error("Failed to open plugin config " + this.name, { cause: event.error ?? event.target }));
            }
            if(upgradeHandler != null) {
                request.onupgradeneeded = (event) => {
                    upgradeHandler(event.target as IDBDatabase);
                }
            }
        })
    }

    public async createIDBObjectStores(...names: string[]) {
        this.db.close();
        this.setDb(null);
        const db = await this.openDb(db => {
            for(const name of names) db.createObjectStore(name);
        })
        this.setDb(db);
    }

    private setDb(db: IDBDatabase) {
        this.db = db;
        for(const store of this.stores.values()) {
            store.setIDBDatabase(db);
        }
    }

    public async objectStore<Schema>(name: string): Promise<PluginObjectStore<Schema>> {
        if(this.db == null) await this.open();

        if(this.stores.has(name)) {
            return this.stores.get(name);
        }

        const store = new PluginObjectStore<Schema>(this.db, this, name);
        await store.open();
        this.stores.set(name, store);
        return store;
    }
}