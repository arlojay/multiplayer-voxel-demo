import { bufferToHex } from "../bitUtils";
import { DatabaseObjectStore, DatabaseView } from "../server/databaseView";
import { DataLibraryAsset, DataLibraryAssetReference } from "./dataLibraryAssetTypes";
import { LibraryDataLocator } from "./libraryDataLocator";

const DATA_VERSION = 1;

export interface DataLibraryItem {
    location: string;
    
    blob?: Blob;
    hash?: string;
    fetchDate: Date;
    lastUsedDate: Date;
}

export interface SerializedDataLibraryItem {
    reference: DataLibraryAssetReference;

    location: string;
    buffer: ArrayBuffer;
    type: string;
    hash: string;

    fetchDate: string;
    lastUsedDate: string;
}

export class DataLibrary {
    public readonly id: string;
    private readonly store: DatabaseObjectStore<"reference", SerializedDataLibraryItem>;
    private locator: LibraryDataLocator;

    private readonly data: Map<string, Map<string, DataLibraryAsset>> = new Map;

    constructor(id: string, store: DatabaseObjectStore<"reference", SerializedDataLibraryItem>) {
        this.id = id;
        this.store = store;
    }

    public isOpen() {
        return this.locator != null;
    }
    public async open(locator: LibraryDataLocator) {
        if(this.isOpen()) throw new Error("Library already open");

        this.locator = locator;

        for(const itemReference of this.store.objects.keys()) {
            const item = await this.store.get(itemReference);
            let map = this.data.get(item.data.location);
            if(map == null) {
                map = new Map;
                this.data.set(item.data.location, map);
            }
            console.log(item.data);
            map.set(item.data.hash, new DataLibraryAsset({
                fetchDate: new Date(item.data.fetchDate),
                lastUsedDate: new Date(item.data.lastUsedDate),
                location: item.data.location,
                hash: item.data.hash
            }));
        }
    }
    public close() {
        this.locator = null;
    }

    private async locateItem(location: string) {
        const blob = await this.locator.get(location);

        const item: DataLibraryItem = {
            location,
            fetchDate: new Date,
            lastUsedDate: new Date
        };

        const buffer = await blob.arrayBuffer();
        item.blob = blob;
        item.hash = await crypto.subtle.digest({ name: "SHA-1" }, buffer).then(bufferToHex);

        return item;
    }
    private async createNewAsset(item: DataLibraryItem) {
        const instance = new DataLibraryAsset(item);
        let assetMap = this.data.get(item.location);
        if(assetMap == null) {
            assetMap = new Map;
            this.data.set(item.location, assetMap);
        }
        assetMap.set(item.hash, instance);
        
        return instance;
    }
    private async writeAsset(asset: DataLibraryAsset) {
        this.store.create(asset.toReference(), {
            buffer: await asset.item.blob.arrayBuffer(),
            location: asset.item.location,
            type: asset.item.blob.type,
            hash: asset.item.hash,

            fetchDate: asset.item.fetchDate.toISOString(),
            lastUsedDate: asset.item.lastUsedDate.toISOString()
        });
    }
    
    public async getAsset(location: string, hash?: string): Promise<DataLibraryAsset> {
        console.trace(location, hash);
        console.log("get asset", location);
        if(this.data.has(location)) { // has in database
            console.log("has in database");
            const assetMap = this.data.get(location);
            let asset: DataLibraryAsset = null;
            
            if(hash == null) { // typically used on server; load asset for syndication
                console.log("no hash passed");
                asset = assetMap.values().reduce((newest, current) => {
                    if(newest == null) return current;

                    if(current.item.lastUsedDate.getTime() > newest.item.lastUsedDate.getTime()) {
                        return current;
                    } else {
                        return newest;
                    }
                }, null);
            } else { // get specific asset with location and hash
                console.log("hash passed", hash);
                asset = assetMap.get(hash);
            }
            if(asset != null) { // asset with specific hash found in memory (or most recently used asset)
                console.log("asset is not null");
                if(asset.loaded()) return this.useAsset(asset); // asset blob is already loaded
                console.log("asset is not loaded");

                // load blob from library database
                const dbitem = await this.store.get(asset.toReference());
                console.log(dbitem);
                asset.item.blob = new Blob([dbitem.data.buffer], { type: dbitem.data.type });

                if(hash == null) { // try locating item to see if there's a newer version
                    console.log("2. no hash passed");
                    try {
                        const locatedItem = await this.locateItem(location);
                        const existingAsset = assetMap.get(locatedItem.hash);

                        if(existingAsset == null) { // new version found
                            console.log("new located found");
                            const newAsset = await this.createNewAsset(locatedItem);
                            await this.writeAsset(newAsset);
                            return this.useAsset(newAsset);
                        } else { // newest version is already found in library
                            console.log("existing found");
                            return this.useAsset(existingAsset);
                        }
                    } catch(e) { // item locating failed
                        console.warn("Failed to locate item " + location + ". Using library cache.");
                        return this.useAsset(asset);
                    }
                } else { // location and hash match one in library, and asset was just loaded
                    console.log("2. hash passed");
                    return this.useAsset(asset);
                }
            } else {
                console.log("asset is null");
            }
        }
        console.log("cache miss");
        // library cache miss; locate item and create new asset
        const item = await this.locateItem(location);
        const asset = await this.createNewAsset(item);
        await this.writeAsset(asset);

        return this.useAsset(asset);
    }
    private useAsset(asset: DataLibraryAsset) {
        this.store.get(asset.toReference()).then(dbitem => {
            dbitem.data.lastUsedDate = new Date().toISOString();
            return dbitem.save();
        })
        return asset;
    }
}

export type DataLibraryManagerContext = "server" | "client";

export class DataLibraryManager {
    private readonly libraries: Map<string, DataLibrary> = new Map;
    private db: DatabaseView;
    public context: DataLibraryManagerContext;

    constructor(context: DataLibraryManagerContext) {
        this.context = context;
    }

    public async open() {
        this.db = new DatabaseView("data-library/" + this.context);
        await this.db.open();

        for await(const libraryId of this.db.getObjectStoreNames()) {
            await this.getLibrary(libraryId);
        }
    }

    public async getLibrary(libraryId: string) {
        console.log("get library", libraryId);
        if(this.libraries.has(libraryId)) return this.libraries.get(libraryId);
        console.log("create store");
        const store = await this.db.objectStore<"reference", SerializedDataLibraryItem>(libraryId, "reference");
        console.log(store);

        const library = new DataLibrary(libraryId, store);
        this.libraries.set(libraryId, library);

        return library;
    }
}