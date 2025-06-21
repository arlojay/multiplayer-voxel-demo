import { flatPack, inflate, PackingOptions } from "./flatPackedObject";

let transactions = 0;
let openTransactions = 0;

const transactingLocations: Map<string, number> = new Map;

setInterval(() => {
    if(transactions > 0) {
        console.debug(transactions + " transactions made");
    }
    if(openTransactions > 0) {
        console.debug(openTransactions + " transactions open");
    }
    for(const [ location, count ] of transactingLocations.entries()) {
        if(count > 0) console.debug(location + " has " + count + " active transactions");
    }
    transactions = 0;
}, 1000);

export function waitForTransaction(transaction: IDBTransaction) {
    transactions++;
    openTransactions++;

    const locations: string[] = new Array;
    for(const storeName of Array.from(transaction.objectStoreNames)) {
        const locationName = transaction.mode + ":" + transaction.db.name + "." + storeName;
        locations.push(locationName);
    }

    for(const locationName of locations) {
        let count = transactingLocations.get(locationName) ?? 0;
        count++;
        transactingLocations.set(locationName, count);
    }
    
    return new Promise<void>((res, rej) => {
        transaction.oncomplete = () => {
            openTransactions--;
            for(const locationName of locations) {
                transactingLocations.set(locationName, transactingLocations.get(locationName) - 1);
            }
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

export async function openDbSimple(
    onupgradeneeded: (request: IDBOpenDBRequest, event: IDBVersionChangeEvent) => void,
    name: string,
    version?: number
) {
    if(version == null) {
        const info = await indexedDB.databases().then(databases => databases.find(info => info.name == name));
        version = info.version;
    }

    return await new Promise<IDBDatabase>((res, rej) => {
        const request = indexedDB.open(name, version);
        request.onsuccess = () => {
            res(request.result);
        };
        request.onerror = (event: ErrorEvent) => {
            rej(new Error("Cannot open database " + name, { cause: event.error ?? (event as any).target?.error }));
        };
        request.onupgradeneeded = (event) => {
            onupgradeneeded(request, event);
        };
    });
}

export async function openDb(name: string, schema: DBSchema) {
    return await openDbSimple((request, event) => {
        for(let version = event.oldVersion; version < event.newVersion; version++) {
            schema.upgrade(request.result, version + 1);
        }
    }, name, schema.version);
}

export async function dbExists(name: string) {
    return await indexedDB.databases().then(databases => databases.some(info => info.name == name));
}

export async function cloneDb(sourceName: string, targetName: string) {
    console.debug("Cloning database " + sourceName + " to " + targetName);

    const source = await openDbSimple((request, event) => {
        throw new TypeError("Cloning source database has mismatched version");
    }, sourceName);
    const storeNames = Array.from(source.objectStoreNames);

    console.debug("Opening target database in version " + source.version);
    const target = await openDbSimple((request, event) => {
        const transaction = source.transaction(storeNames, "readonly");
        for(const storeName of storeNames) {
            console.debug("Creating object store " + storeName, transaction.objectStore(storeName));
            request.result.createObjectStore(storeName, transaction.objectStore(storeName));
        }
    }, targetName, source.version);
    
    for(const storeName of storeNames) {
        console.debug("Cloning store " + storeName);
        
        const sourceTransaction = source.transaction(storeName, "readonly");

        const allItems = sourceTransaction.objectStore(storeName).getAll();
        await waitForTransaction(sourceTransaction);
        
        const targetTransaction = target.transaction(storeName, "readwrite");
        console.debug("Adding " + allItems.result.length + " items");
        for(const item of allItems.result) {
            targetTransaction.objectStore(storeName).add(item);
        }
        await waitForTransaction(targetTransaction);
    }
    source.close();
    target.close();
}