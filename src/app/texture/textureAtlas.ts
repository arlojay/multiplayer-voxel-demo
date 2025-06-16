import { Texture } from "three";
import { IndexedPackingObject, SkylinePackedAtlas } from "./skylinePackedAtlas";

export class TextureAtlas {
    public textures: Set<Texture> = new Set;
    private built = false;
    public builtTexture: Texture = null;
    public workingAtlas: SkylinePackedAtlas<Texture>;
    public width: number = null;
    public height: number = null;

    public addTexture(texture: Texture) {
        if(this.built) throw new ReferenceError("Cannot modify built texture atlas");
        this.textures.add(texture);
    }
    public getTexturePosition(texture: Texture) {
        return this.workingAtlas.placedObjectMap.get(texture);
    }

    private trySize(indexedTextures: IndexedPackingObject<Texture>[], width: number, height: number) {
        const prototypeAtlas = new SkylinePackedAtlas(width, height);

        for(const texture of indexedTextures) {
            try {
                prototypeAtlas.tryPlace(texture);
            } catch(e) {
                throw new Error("Failed to place texture " + texture.object.image.src + " (" + texture.id + ")", { cause: e });
            }
        }

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);

        for(const placedObject of prototypeAtlas.placedObjects) {
            ctx.drawImage(placedObject.object.object.image, placedObject.left, placedObject.top);
        }

        return {
            texture: new Texture(canvas),
            atlas: prototypeAtlas
        };
    }

    public build(maxSize = 4096) {
        const t0 = performance.now();

        const indexedTextures: IndexedPackingObject<Texture>[] = Array.from(this.textures)
            .map((texture, id) => ({
                id,
                width: texture.image.width,
                height: texture.image.height,
                
                object: texture
            }))
            .sort((textureA, textureB) =>
                textureB.width * textureB.height - textureA.width * textureA.height
            );

        let width = 1;
        let height = 1;

        let s = 0;
        let tries = 0;
        
        while(!this.built && tries < 4096) {
            tries++;
            if(width > maxSize && height > maxSize) throw new RangeError("Cannot find valid atlas (" + tries + " tries)");

            if(width > maxSize) continue;
            if(height > maxSize) continue;
            try {
                const details = this.trySize(indexedTextures, width, height);

                this.workingAtlas = details.atlas;
                this.builtTexture = details.texture;
                this.built = true;

                this.builtTexture.needsUpdate = true;
            } catch(e) {
                if(s == 0) width *= 2;
                else [ width, height ] = [ height, width ];
                s = (s + 1) % 2;
            }
        }

        this.width = width;
        this.height = height;

        this.builtTexture.image.convertToBlob().then((blob: Blob) => {
            console.log(this);
            console.log(URL.createObjectURL(blob));
        })
        console.log("Built " + this.textures.size + "-texture atlas in " + (performance.now() - t0) + "ms, " + tries + " tries");
    }
}