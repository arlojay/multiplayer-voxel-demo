import { bufferToHex } from "../serialization/bitUtils";
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
    private readonly itemsToUpdate: Set<string> = new Set;
    private updateLoop: number | any;

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
            map.set(item.data.hash, new DataLibraryAsset({
                fetchDate: new Date(item.data.fetchDate),
                lastUsedDate: new Date(item.data.lastUsedDate),
                location: item.data.location,
                hash: item.data.hash
            }));
        }

        this.updateLoop = setInterval(async () => {
            for(const reference of this.itemsToUpdate) {
                this.store.get(reference).then(dbitem => {
                    dbitem.data.lastUsedDate = new Date().toISOString();
                    dbitem.save();
                })
            }
            this.itemsToUpdate.clear();
        }, 1000);
    }
    public close() {
        this.locator = null;
        clearInterval(this.updateLoop);
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
        if(this.data.has(location)) { // has in database
            const assetMap = this.data.get(location);
            let asset: DataLibraryAsset = null;
            
            if(hash == null) { // typically used on server; load asset for syndication
                asset = assetMap.values().reduce((newest, current) => {
                    if(newest == null) return current;

                    if(current.item.lastUsedDate.getTime() > newest.item.lastUsedDate.getTime()) {
                        return current;
                    } else {
                        return newest;
                    }
                }, null);
            } else { // get specific asset with location and hash
                asset = assetMap.get(hash);
            }
            if(asset != null) { // asset with specific hash found in memory (or most recently used asset)
                if(asset.loaded()) return this.useAsset(asset); // asset blob is already loaded

                // load blob from library database
                const dbitem = await this.store.get(asset.toReference());
                asset.item.blob = new Blob([dbitem.data.buffer], { type: dbitem.data.type });

                if(hash == null) { // try locating item to see if there's a newer version
                    try {
                        const locatedItem = await this.locateItem(location);
                        const existingAsset = assetMap.get(locatedItem.hash);

                        if(existingAsset == null) { // new version found
                            const newAsset = await this.createNewAsset(locatedItem);
                            await this.writeAsset(newAsset);
                            return this.useAsset(newAsset);
                        } else { // newest version is already found in library
                            return this.useAsset(existingAsset);
                        }
                    } catch(e) { // item locating failed
                        return this.useAsset(asset);
                    }
                } else { // location and hash match one in library, and asset was just loaded
                    return this.useAsset(asset);
                }
            }
        }
        // library cache miss; locate item and create new asset
        const item = await this.locateItem(location);
        const asset = await this.createNewAsset(item);
        await this.writeAsset(asset);

        return this.useAsset(asset);
    }
    private useAsset(asset: DataLibraryAsset) {
        this.itemsToUpdate.add(asset.toReference());
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
        if(this.libraries.has(libraryId)) return this.libraries.get(libraryId);
        const store = await this.db.objectStore<"reference", SerializedDataLibraryItem>(libraryId, "reference");

        const library = new DataLibrary(libraryId, store);
        this.libraries.set(libraryId, library);

        return library;
    }
}