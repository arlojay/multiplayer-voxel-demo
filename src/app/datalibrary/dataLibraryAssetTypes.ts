import { ImageBitmapLoader, Texture, TextureLoader } from "three";
import { capabilities } from "../capability";
import { DataLibrary, DataLibraryItem } from "./dataLibrary";

export enum DataLibraryAssetType {
    UNKNOWN = "unknown",
    TEXTURE = "texture",
    SOUND = "sound",
}

export type DataLibraryAssetReference = `${string}§${string}`; // location§hash

export class DataLibraryAsset<AssetType = unknown> {
    public static async fromReference(reference: DataLibraryAssetReference, dataLibrary: DataLibrary) {
        const [ location, hash ] = reference.split("§");
        return await dataLibrary.getAsset(location, hash);
    }
    public readonly item: DataLibraryItem;
    
    public constructor(item: DataLibraryItem) {
        this.item = item;
    }
    public loaded() {
        return this.item.blob != null;
    }
    public toReference(): DataLibraryAssetReference {
        return `${this.item.location}§${this.item.hash}`;
    }

    private loadedTexture: Texture;

    public async loadTexture(): Promise<DataLibraryAsset<Texture>> {
        if(this.loadedTexture != null) return this;

        const blobUrl = URL.createObjectURL(this.item.blob);
        if(capabilities.DOCUMENT) {
            this.loadedTexture = await new TextureLoader().loadAsync(blobUrl);
        } else {
            const loader = new ImageBitmapLoader();
            this.loadedTexture = await loader.loadAsync(blobUrl).then(image => new Texture(image));
        }
        this.loadedTexture.colorSpace = "srgb";
        return this;
    }
    public getTexture() {
        return this.loadedTexture;
    }
}