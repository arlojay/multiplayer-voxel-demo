import { waitForTransaction } from "../dbUtils";
import { inflate } from "../flatPackedObject";
import { ServerData } from "./serverData";

export class DatabaseObjectStore<Schema> {
    public data: Schema;

    private db: IDBDatabase;
    public view: DatabaseView;
    public name: string;

    public constructor(db: IDBDatabase, view: DatabaseView, name: string) {
        this.db = db;
        this.view = view;
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
            await this.view.createIDBObjectStores(this.name);
        }

        const transaction = this.db.transaction(this.name, "readonly");
        const allKeys = transaction.objectStore(this.name).getAll();

        await waitForTransaction(transaction);
        const data = this.proxyProperty(inflate(allKeys.result), []);

        this.data = data;
    }

    public setIDBDatabase(db: IDBDatabase) {
        this.db = db;
    }
}

export class DatabaseView {
    public name: string;
    public serverData: ServerData;
    private db: IDBDatabase;
    private stores: Map<string, DatabaseObjectStore<any>>;
    private dir: string;

    constructor(serverData: ServerData, name: string, dir: string) {
        this.serverData = serverData;
        this.name = name;
        this.dir = dir;
    }

    public async open() {
        this.setDb(await this.openDb());
    }

    public getFullName() {
        return "servers/" + this.serverData.id + "/" + this.dir + "/" + this.name;
    }

    private async openDb(upgradeHandler?: (db: IDBDatabase) => void) {
        const fullName = this.getFullName();

        const descriptor = await indexedDB.databases().then(dbs => dbs.find(db => db.name == fullName));
        let version = descriptor.version ?? 1;
        if(upgradeHandler != null) version++;

        return await new Promise<IDBDatabase>((res, rej) => {
            const request = indexedDB.open(fullName, version);
            request.onsuccess = () => res(request.result);

            request.onerror = (event: ErrorEvent) => {
                rej(new Error("Failed to open database " + fullName, { cause: event.error ?? event.target }));
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

    public async objectStore<Schema>(name: string): Promise<DatabaseObjectStore<Schema>> {
        if(this.db == null) await this.open();

        if(this.stores.has(name)) {
            return this.stores.get(name);
        }

        const store = new DatabaseObjectStore<Schema>(this.db, this, name);
        await store.open();
        this.stores.set(name, store);
        return store;
    }
}