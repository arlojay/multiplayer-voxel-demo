import { flatPack, inflate, PackingOptions } from "./flatPackedObject";

export function waitForTransaction(transaction: IDBTransaction) {
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
export async function loadObjectStoreIntoJson(json: object, objectStore: IDBObjectStore) {
    const request = objectStore.getAll();

    try {
        await waitForTransaction(request.transaction);
    } catch(e) {
        throw new Error("Failed to load object store as json", { cause: e });
    }
    
    const packed: Record<string, any> = flatPack(json);
    for(const prop of request.result) {
        packed[prop.name] = prop.value;
    }
    Object.assign(json, inflate(packed));
}
export async function saveJsonAsObjectStore(json: object, objectStore: IDBObjectStore, packingOptions: PackingOptions = {}) {
    const packed = flatPack(json, packingOptions);

    for(const key in packed) {
        objectStore.put({
            name: key,
            value: packed[key]
        })
    }

    try {
        await waitForTransaction(objectStore.transaction);
    } catch(e) {
        throw new Error("Failed to save json as object store", { cause: e });
    }
}

export interface DBSchema {
    version: number;
    upgrade: (db: IDBDatabase, target: number) => void;
}

export async function openDb(name: string, schema: DBSchema) {
    return await new Promise<IDBDatabase>((res, rej) => {
        const request = indexedDB.open(name, schema.version);
        request.onsuccess = () => {
            res(request.result);
        };
        request.onerror = (event: ErrorEvent) => {
            rej(new Error("Cannot open database " + this.id, { cause: event.error ?? (event as any).target?.error }));
        };
        request.onupgradeneeded = (event) => {
            for(let version = event.oldVersion; version < event.newVersion; version++) {
                schema.upgrade(request.result, version + 1);
            }
        };
    });
}