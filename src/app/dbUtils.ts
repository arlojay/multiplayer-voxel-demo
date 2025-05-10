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