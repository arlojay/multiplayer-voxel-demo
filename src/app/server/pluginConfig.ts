import { waitForTransaction } from "../dbUtils";
import { inflate } from "../flatPackedObject";
import { RichSerializedJson } from "../objectSerializer";
import { ServerData } from "./serverData";

export class DatabaseObject<KeyPath extends string, Schema = any> {
    public db: IDBDatabase;
    public objectStore: DatabaseObjectStore<KeyPath, Schema>;
    public data: Omit<Schema, KeyPath>;
    public key: string;

    public constructor(db: IDBDatabase, objectStore: DatabaseObjectStore<KeyPath, Schema>, key: string, data: any) {
        this.db = db;
        this.objectStore = objectStore;
        this.key = key;
        this.data = this.objectStore.dataType.deserialize(data) as typeof this.data;
    }

    public async save() {
        const transaction = this.db.transaction(this.objectStore.name, "readwrite");
        const obj = this.objectStore.dataType.serialize(this.data);
        obj[this.objectStore.keyPath] = this.key;
        transaction.objectStore(this.objectStore.name).put(obj);
        await waitForTransaction(transaction);
    }

    public async delete() {
        await this.objectStore.delete(this.key);
    }
}

export class DatabaseObjectStore<KeyPath extends string, Schema = any> {
    public dataType = new RichSerializedJson;
    public objects: Map<string, DatabaseObject<KeyPath, Schema>> = new Map;

    private db: IDBDatabase;
    public view: DatabaseView;
    public name: string;
    public keyPath: KeyPath;

    public constructor(db: IDBDatabase, view: DatabaseView, name: string, keyPath: KeyPath) {
        this.db = db;
        this.view = view;
        this.name = name;
        this.keyPath = keyPath;
    }

    public async open() {
        if(!this.db.objectStoreNames.contains(this.name)) {
            await this.view.createIDBObjectStore(this.name, this.keyPath);
        }

        const transaction = this.db.transaction(this.name, "readonly");
        const allKeys = transaction.objectStore(this.name).getAllKeys();

        await waitForTransaction(transaction);
        for(const key of allKeys.result) {
            this.objects.set(key as string, null);
        }
    }

    public has(key: string) {
        return this.objects.has(key);
    }

    public async create(key: string, data: Omit<Schema, KeyPath>) {
        console.log("CREATE " + key);
        const object = new DatabaseObject<KeyPath, Schema>(this.db, this, key, data);

        await object.save();
        this.objects.set(key, object);
        
        return object;
    }

    public async get(key: string) {
        console.log("GET " + key);
        if(this.objects.get(key) != null) return this.objects.get(key);

        const transaction = this.db.transaction(this.name, "readonly");
        const object = transaction.objectStore(this.name).get(key);

        await waitForTransaction(transaction);
        const data = inflate(object.result);
        
        const instance = new DatabaseObject<KeyPath, Schema>(this.db, this, key, data);
        this.objects.set(key, instance);

        return instance;
    }
    public async delete(key: string) {
        const transaction = this.db.transaction(this.name, "readwrite");
        transaction.objectStore(this.name).delete(key);
        await waitForTransaction(transaction);
        this.objects.delete(key);
    }

    public setIDBDatabase(db: IDBDatabase) {
        this.db = db;
    }
}

export class DatabaseView {
    public name: string;
    public serverData: ServerData;
    private db: IDBDatabase;
    private stores: Map<string, DatabaseObjectStore<any>> = new Map;
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
        let version = descriptor?.version ?? 1;
        if(upgradeHandler != null) version++;

        return await new Promise<IDBDatabase>((res, rej) => {
            const request = indexedDB.open(fullName, version);
            request.onsuccess = () => res(request.result);

            request.onerror = (event: ErrorEvent) => {
                rej(new Error("Failed to open database " + fullName, { cause: event.error ?? event.target }));
            }
            if(upgradeHandler != null) {
                request.onupgradeneeded = (event) => {
                    upgradeHandler(request.result as IDBDatabase);
                }
            }
        })
    }

    public async createIDBObjectStore<KeyPath extends string>(name: string, keyPath: KeyPath) {
        this.db.close();
        this.setDb(null);
        const db = await this.openDb(db => {
            db.createObjectStore(name, {
                keyPath: keyPath
            });
        })
        this.setDb(db);
    }

    private setDb(db: IDBDatabase) {
        this.db = db;
        for(const store of this.stores.values()) {
            store.setIDBDatabase(db);
        }
    }

    public async objectStore<KeyPath extends string, Schema>(name: string, keyPath: KeyPath): Promise<DatabaseObjectStore<KeyPath, Schema>> {
        if(this.db == null) await this.open();

        if(this.stores.has(name)) {
            return this.stores.get(name);
        }

        const store = new DatabaseObjectStore<KeyPath, Schema>(this.db, this, name, keyPath);
        this.stores.set(name, store);
        await store.open();
        return store;
    }
}