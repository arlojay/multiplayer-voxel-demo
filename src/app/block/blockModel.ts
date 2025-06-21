import { Box3, Color, Texture, Vector2, Vector3 } from "three";
import { CustomVoxelMesh, FaceDirection, packVec2, VoxelMesher } from "../voxelMesher";
import { clamp, map } from "../math";
import { TextureAtlas } from "../texture/textureAtlas";
import { DataLibraryAsset, DataLibraryAssetReference } from "../data/dataLibraryAssetTypes";
import { DataLibrary } from "../data/dataLibrary";

export type SerializedBlockCuboidFace = [
    number, // texture (index from serialized block)
    boolean, // cull
    number, number, // uv min
    number, number, // uv max
    number, // uv rotation
    number // color
]
export class BlockCuboidFace {
    public static async deserialize(serialized: SerializedBlockCuboidFace, usedTextures: DataLibraryAssetReference[], dataLibrary: DataLibrary) {
        const face = new BlockCuboidFace;

        const texture = await DataLibraryAsset.fromReference(usedTextures[serialized[0]], dataLibrary);
        
        face.texture = await texture.loadTexture();
        face.cull = serialized[1];
        face.uvMin.set(serialized[2], serialized[3]);
        face.uvMax.set(serialized[4], serialized[5]);
        face.uvRotation = serialized[6];
        face.color = new Color(serialized[7]);

        return face;
    }

    public texture: DataLibraryAsset<Texture>;
    public cull = true;
    public uvMin = new Vector2(0, 0);
    public uvMax = new Vector2(16, 16);
    public uvRotation = 0;
    public color = new Color(0xffffff);

    public setTexture(texture: DataLibraryAsset) {
        if(texture == null) throw new TypeError("Cannot use a null texture (set face to null instead)");
        const newImage = texture.getTexture().image;

        if(this.texture == null) {
            this.texture = texture;
            this.uvMin.set(0, 0);
            this.uvMax.set(newImage.width, newImage.height);
            return;
        }

        const oldImage = this.texture.getTexture().image;

        const sizeA = new Vector2(oldImage.width, oldImage.height);
        const sizeB = new Vector2(newImage.width, newImage.height).divide(sizeA);
        this.uvMin.multiply(sizeB).round();
        this.uvMax.multiply(sizeB).round();
        
        this.texture = texture;
    }

    public setColor(color: Color) {
        this.color.copy(color);
    }

    public serialize(usedTextures: DataLibraryAssetReference[]): SerializedBlockCuboidFace {
        const textureReference = this.texture.toReference();
        let textureIndex = usedTextures.indexOf(textureReference);
        if(textureIndex == -1) {
            textureIndex = usedTextures.length;
            usedTextures.push(textureReference);
        }
        return [
            textureIndex,
            this.cull,
            this.uvMin.x, this.uvMin.y,
            this.uvMax.x, this.uvMax.y,
            this.uvRotation,
            this.color.getHex()
        ];
    }
}
export type SerializedBlockModelCuboid = [
    number, number, number, // min size
    number, number, number, // max size
    SerializedBlockCuboidFace, // north
    SerializedBlockCuboidFace, // east
    SerializedBlockCuboidFace, // south
    SerializedBlockCuboidFace, // west
    SerializedBlockCuboidFace, // up
    SerializedBlockCuboidFace, // down
]
export class BlockModelCuboid {
    public static async deserialize(serialized: SerializedBlockModelCuboid, usedTextures: DataLibraryAssetReference[], dataLibrary: DataLibrary) {
        const instance = new BlockModelCuboid;
        instance.size.min.set(serialized[0], serialized[1], serialized[2]);
        instance.size.max.set(serialized[3], serialized[4], serialized[5]);
        if(serialized[6] != null) instance.north = await BlockCuboidFace.deserialize(serialized[6], usedTextures, dataLibrary);
        if(serialized[7] != null) instance.east = await BlockCuboidFace.deserialize(serialized[7], usedTextures, dataLibrary);
        if(serialized[8] != null) instance.south = await BlockCuboidFace.deserialize(serialized[8], usedTextures, dataLibrary);
        if(serialized[9] != null) instance.west = await BlockCuboidFace.deserialize(serialized[9], usedTextures, dataLibrary);
        if(serialized[10] != null) instance.up = await BlockCuboidFace.deserialize(serialized[10], usedTextures, dataLibrary);
        if(serialized[11] != null) instance.down = await BlockCuboidFace.deserialize(serialized[11], usedTextures, dataLibrary);

        return instance;
    }

    public size = new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    public north: BlockCuboidFace;
    public east: BlockCuboidFace;
    public south: BlockCuboidFace;
    public west: BlockCuboidFace;
    public up: BlockCuboidFace;
    public down: BlockCuboidFace;

    public createAllFaces() {
        this.north ??= new BlockCuboidFace;
        this.east ??= new BlockCuboidFace;
        this.south ??= new BlockCuboidFace;
        this.west ??= new BlockCuboidFace;
        this.up ??= new BlockCuboidFace;
        this.down ??= new BlockCuboidFace;

        return this;
    }

    public getAllFaces() {
        const faces: BlockCuboidFace[] = new Array;

        if(this.north != null) faces.push(this.north);
        if(this.east != null) faces.push(this.east);
        if(this.south != null) faces.push(this.south);
        if(this.west != null) faces.push(this.west);
        if(this.up != null) faces.push(this.up);
        if(this.down != null) faces.push(this.down);

        return faces;
    }

    public setNorthTexture(texture: DataLibraryAsset) {
        this.north ??= new BlockCuboidFace;
        this.north.setTexture(texture);
        return this;
    }
    public setEastTexture(texture: DataLibraryAsset) {
        this.east ??= new BlockCuboidFace;
        this.east.setTexture(texture);
        return this;
    }
    public setSouthTexture(texture: DataLibraryAsset) {
        this.south ??= new BlockCuboidFace;
        this.south.setTexture(texture);
        return this;
    }
    public setWestTexture(texture: DataLibraryAsset) {
        this.west ??= new BlockCuboidFace;
        this.west.setTexture(texture);
        return this;
    }
    public setUpTexture(texture: DataLibraryAsset) {
        this.up ??= new BlockCuboidFace;
        this.up.setTexture(texture);
        return this;
    }
    public setDownTexture(texture: DataLibraryAsset) {
        this.down ??= new BlockCuboidFace;
        this.down.setTexture(texture);
        return this;
    }

    public setAllTextures(texture: DataLibraryAsset) {
        this.getAllFaces().forEach(face => face.setTexture(texture));
        return this;
    }
    public setAllColors(color: Color): BlockModelCuboid {
        this.getAllFaces().forEach(face => face.setColor(color));
        return this;
    }
    public getUsedTextures(): DataLibraryAsset[] {
        const textures: Set<DataLibraryAsset> = new Set;
        for(const face of this.getAllFaces()) textures.add(face.texture);
        return Array.from(textures);
    }

    public serialize(usedTextures: DataLibraryAssetReference[]): SerializedBlockModelCuboid {
        return [
            this.size.min.x, this.size.min.y, this.size.min.z,
            this.size.max.x, this.size.max.y, this.size.max.z,
            this.north == null ? null : this.north.serialize(usedTextures),
            this.east == null ? null : this.east.serialize(usedTextures),
            this.south == null ? null : this.south.serialize(usedTextures),
            this.west == null ? null : this.west.serialize(usedTextures),
            this.up == null ? null : this.up.serialize(usedTextures),
            this.down == null ? null : this.down.serialize(usedTextures),
        ]
    }
}
export type SerializedBlockModel = [
    SerializedBlockModelCuboid[],
    boolean, // aoCasting
    boolean, // aoReceiving
    boolean, // opaque
    boolean, // cullable
]
export class BlockModel {
    public static async deserialize(serialized: SerializedBlockModel, usedTextures: DataLibraryAssetReference[], dataLibrary: DataLibrary) {
        const model = new BlockModel;
        for(let i = 0; i < serialized[0].length; i++) {
            model.cuboids.push(await BlockModelCuboid.deserialize(serialized[0][i], usedTextures, dataLibrary));
        }
        model.aoCasting = serialized[1];
        model.aoReceiving = serialized[2];
        model.opaque = serialized[3];
        model.cullable = serialized[4];

        return model;
    }
    
    public cuboids: BlockModelCuboid[] = new Array;

    public aoCasting = true;
    public aoReceiving = true;
    public opaque = true;
    public cullable = true;

    public constructor(...cuboids: BlockModelCuboid[]) {
        this.cuboids.push(...cuboids);
    }

    public getUsedTextures(): DataLibraryAsset[] {
        const textures: Set<DataLibraryAsset> = new Set;
        for(const cuboid of this.cuboids) {
            for(const face of cuboid.getAllFaces()) {
                textures.add(face.texture);
            }
        }
        return Array.from(textures);
    }

    public serialize(usedTextures: DataLibraryAssetReference[]): SerializedBlockModel {
        return [
            this.cuboids.map(cuboid => cuboid.serialize(usedTextures)),
            this.aoCasting,
            this.aoReceiving,
            this.opaque,
            this.cullable
        ];
    }
}

interface CompiledModelFace {
    cull: boolean;
    direction: FaceDirection;
    localWidthMin: number;
    localWidthMax: number;
    localHeightMin: number;
    localHeightMax: number;
    localDepthPos: number;
    color: number;
    uvNN: number;
    uvNP: number;
    uvPN: number;
    uvPP: number;
    fposNN: number;
    fposNP: number;
    fposPN: number;
    fposPP: number;
}

async function compileFaceUVs(face: BlockCuboidFace, textureAtlas: TextureAtlas) {
    await face.texture.loadTexture();
    const entry = textureAtlas.getTexturePosition(face.texture.getTexture());

    let top = textureAtlas.height - entry.top;
    let left = entry.left;
    let bottom = top - face.uvMax.y;
    let right = left + face.uvMax.x;

    left += face.uvMin.x;
    top -= face.uvMin.y;
    
    return {
        uvNN: packVec2(
            Math.round(left),
            Math.round(bottom),
        ),
        uvNP: packVec2(
            Math.round(left),
            Math.round(top),
        ),
        uvPN: packVec2(
            Math.round(right),
            Math.round(bottom),
        ),
        uvPP: packVec2(
            Math.round(right),
            Math.round(top),
        ),
    };
}
function compileFacePositions(left: number, bottom: number, right: number, top: number) {
    left = map(left, 0, 1, 0x7fdf, 0x801f);
    bottom = map(bottom, 0, 1, 0x7fdf, 0x801f);
    right = map(right, 0, 1, 0x7fdf, 0x801f);
    top = map(top, 0, 1, 0x7fdf, 0x801f);
    return {
        fposNN: packVec2(left, bottom),
        fposNP: packVec2(left, top),
        fposPN: packVec2(right, bottom),
        fposPP: packVec2(right, top),
    };
}
function getColor(color: Color) {
    return (
        Math.floor(Math.min(255, color.r * 256)) << 16 |
        Math.floor(Math.min(255, color.g * 256)) << 8 |
        Math.floor(Math.min(255, color.b * 256))
    )
}

export async function compileBlockModel(model: BlockModel, textureAtlas: TextureAtlas): Promise<CustomVoxelMesh> {
    const faces: CompiledModelFace[] = new Array;

    for await(const cuboid of model.cuboids) {
        if(cuboid.north != null) faces.push({
            direction: FaceDirection.NORTH,
            cull: cuboid.north.cull,
            localWidthMin: cuboid.size.min.x,
            localWidthMax: cuboid.size.max.x,
            localHeightMin: cuboid.size.min.y,
            localHeightMax: cuboid.size.max.y,
            localDepthPos: cuboid.size.min.z,
            color: getColor(cuboid.north.color),
            ...await compileFaceUVs(cuboid.north, textureAtlas),
            ...compileFacePositions(cuboid.size.min.x, cuboid.size.min.y, cuboid.size.max.x, cuboid.size.max.y)
        });
        if(cuboid.south != null) faces.push({
            direction: FaceDirection.SOUTH,
            cull: cuboid.south.cull,
            localWidthMin: cuboid.size.min.x,
            localWidthMax: cuboid.size.max.x,
            localHeightMin: cuboid.size.min.y,
            localHeightMax: cuboid.size.max.y,
            localDepthPos: cuboid.size.max.z,
            color: getColor(cuboid.south.color),
            ...await compileFaceUVs(cuboid.south, textureAtlas),
            ...compileFacePositions(cuboid.size.min.x, cuboid.size.min.y, cuboid.size.max.x, cuboid.size.max.y)
        });
        if(cuboid.east != null) faces.push({
            direction: FaceDirection.EAST,
            cull: cuboid.east.cull,
            localWidthMin: cuboid.size.min.z,
            localWidthMax: cuboid.size.max.z,
            localHeightMin: cuboid.size.min.y,
            localHeightMax: cuboid.size.max.y,
            localDepthPos: cuboid.size.max.x,
            color: getColor(cuboid.east.color),
            ...await compileFaceUVs(cuboid.east, textureAtlas),
            ...compileFacePositions(cuboid.size.min.z, cuboid.size.min.y, cuboid.size.max.z, cuboid.size.max.y)
        });
        if(cuboid.west != null) faces.push({
            direction: FaceDirection.WEST,
            cull: cuboid.west.cull,
            localWidthMin: cuboid.size.min.z,
            localWidthMax: cuboid.size.max.z,
            localHeightMin: cuboid.size.min.y,
            localHeightMax: cuboid.size.max.y,
            localDepthPos: cuboid.size.min.x,
            color: getColor(cuboid.west.color),
            ...await compileFaceUVs(cuboid.west, textureAtlas),
            ...compileFacePositions(cuboid.size.min.z, cuboid.size.min.y, cuboid.size.max.z, cuboid.size.max.y)
        });
        if(cuboid.up != null) faces.push({
            direction: FaceDirection.UP,
            cull: cuboid.up.cull,
            localWidthMin: cuboid.size.min.x,
            localWidthMax: cuboid.size.max.x,
            localHeightMin: cuboid.size.min.z,
            localHeightMax: cuboid.size.max.z,
            localDepthPos: cuboid.size.max.y,
            color: getColor(cuboid.up.color),
            ...await compileFaceUVs(cuboid.up, textureAtlas),
            ...compileFacePositions(cuboid.size.min.x, cuboid.size.min.z, cuboid.size.max.x, cuboid.size.max.z)
        });
        if(cuboid.down != null) faces.push({
            direction: FaceDirection.DOWN,
            cull: cuboid.down.cull,
            localWidthMin: cuboid.size.min.x,
            localWidthMax: cuboid.size.max.x,
            localHeightMin: cuboid.size.min.z,
            localHeightMax: cuboid.size.max.z,
            localDepthPos: cuboid.size.min.y,
            color: getColor(cuboid.down.color),
            ...await compileFaceUVs(cuboid.down, textureAtlas),
            ...compileFacePositions(cuboid.size.min.x, cuboid.size.min.z, cuboid.size.max.x, cuboid.size.max.z)
        });
    }

    const facesNorth = faces.filter(face => face.direction == FaceDirection.NORTH);
    const facesSouth = faces.filter(face => face.direction == FaceDirection.SOUTH);
    const facesEast = faces.filter(face => face.direction == FaceDirection.EAST);
    const facesWest = faces.filter(face => face.direction == FaceDirection.WEST);
    const facesUp = faces.filter(face => face.direction == FaceDirection.UP);
    const facesDown = faces.filter(face => face.direction == FaceDirection.DOWN);
    
    const facesNorthAlways = facesNorth.filter(face => !face.cull);
    const facesSouthAlways = facesSouth.filter(face => !face.cull);
    const facesEastAlways = facesEast.filter(face => !face.cull);
    const facesWestAlways = facesWest.filter(face => !face.cull);
    const facesUpAlways = facesUp.filter(face => !face.cull);
    const facesDownAlways = facesDown.filter(face => !face.cull);

    return {
        aoCasting: model.aoCasting,
        aoReceiving: model.aoReceiving,
        opaque: model.opaque,
        cullable: model.cullable,
        build(mesher, vertices, bindata, indices, x, y, z, color) {
            let vcount = mesher.vertexCount;
            const ao = model.aoReceiving ? mesher.packedAO : VoxelMesher.NO_AO;

            // West
            for(const face of mesher.renderFace[FaceDirection.WEST] ? facesWest : facesWestAlways) {
                vertices.push(
                    x + face.localDepthPos, y + face.localHeightMax, z + face.localWidthMin,
                    x + face.localDepthPos, y + face.localHeightMax, z + face.localWidthMax,
                    x + face.localDepthPos, y + face.localHeightMin, z + face.localWidthMax,
                    x + face.localDepthPos, y + face.localHeightMin, z + face.localWidthMin,
                );
                bindata.push(
                    face.color, ao[FaceDirection.WEST], face.fposNP, face.uvNP,
                    face.color, ao[FaceDirection.WEST], face.fposPP, face.uvPP,
                    face.color, ao[FaceDirection.WEST], face.fposPN, face.uvPN,
                    face.color, ao[FaceDirection.WEST], face.fposNN, face.uvNN
                );
                indices.push(
                    vcount + 2, vcount + 1, vcount,
                    vcount, vcount + 3, vcount + 2
                );
                vcount += 4;
            }

            // East
            for(const face of mesher.renderFace[FaceDirection.EAST] ? facesEast : facesEastAlways) {
                vertices.push(
                    x + face.localDepthPos, y + face.localHeightMax, z + face.localWidthMax,
                    x + face.localDepthPos, y + face.localHeightMax, z + face.localWidthMin,
                    x + face.localDepthPos, y + face.localHeightMin, z + face.localWidthMin,
                    x + face.localDepthPos, y + face.localHeightMin, z + face.localWidthMax,
                );
                bindata.push(
                    face.color, ao[FaceDirection.EAST], face.fposNP, face.uvNP,
                    face.color, ao[FaceDirection.EAST], face.fposPP, face.uvPP,
                    face.color, ao[FaceDirection.EAST], face.fposPN, face.uvPN,
                    face.color, ao[FaceDirection.EAST], face.fposNN, face.uvNN
                );
                indices.push(
                    vcount + 2, vcount + 1, vcount,
                    vcount, vcount + 3, vcount + 2
                );
                vcount += 4;
            }

            // South
            for(const face of mesher.renderFace[FaceDirection.SOUTH] ? facesSouth : facesSouthAlways) {
                vertices.push(
                    x + face.localWidthMin, y + face.localHeightMax, z + face.localDepthPos,
                    x + face.localWidthMax, y + face.localHeightMax, z + face.localDepthPos,
                    x + face.localWidthMax, y + face.localHeightMin, z + face.localDepthPos,
                    x + face.localWidthMin, y + face.localHeightMin, z + face.localDepthPos,
                );
                bindata.push(
                    face.color, ao[FaceDirection.SOUTH], face.fposNP, face.uvNP,
                    face.color, ao[FaceDirection.SOUTH], face.fposPP, face.uvPP,
                    face.color, ao[FaceDirection.SOUTH], face.fposPN, face.uvPN,
                    face.color, ao[FaceDirection.SOUTH], face.fposNN, face.uvNN
                );
                indices.push(
                    vcount + 2, vcount + 1, vcount,
                    vcount, vcount + 3, vcount + 2
                );
                vcount += 4;
            }

            // North
            for(const face of mesher.renderFace[FaceDirection.NORTH] ? facesNorth : facesNorthAlways) {
                vertices.push(
                    x + face.localWidthMax, y + face.localHeightMax, z + face.localDepthPos,
                    x + face.localWidthMin, y + face.localHeightMax, z + face.localDepthPos,
                    x + face.localWidthMin, y + face.localHeightMin, z + face.localDepthPos,
                    x + face.localWidthMax, y + face.localHeightMin, z + face.localDepthPos,
                );
                bindata.push(
                    face.color, ao[FaceDirection.NORTH], face.fposNP, face.uvNP,
                    face.color, ao[FaceDirection.NORTH], face.fposPP, face.uvPP,
                    face.color, ao[FaceDirection.NORTH], face.fposPN, face.uvPN,
                    face.color, ao[FaceDirection.NORTH], face.fposNN, face.uvNN
                );
                indices.push(
                    vcount + 2, vcount + 1, vcount,
                    vcount, vcount + 3, vcount + 2
                );
                vcount += 4;
            }

            // Up
            for(const face of mesher.renderFace[FaceDirection.UP] ? facesUp : facesUpAlways) {
                vertices.push(
                    x + face.localWidthMin, y + face.localDepthPos, z + face.localHeightMin,
                    x + face.localWidthMax, y + face.localDepthPos, z + face.localHeightMin,
                    x + face.localWidthMax, y + face.localDepthPos, z + face.localHeightMax,
                    x + face.localWidthMin, y + face.localDepthPos, z + face.localHeightMax,
                );
                bindata.push(
                    face.color, ao[FaceDirection.UP], face.fposNP, face.uvNP,
                    face.color, ao[FaceDirection.UP], face.fposPP, face.uvPP,
                    face.color, ao[FaceDirection.UP], face.fposPN, face.uvPN,
                    face.color, ao[FaceDirection.UP], face.fposNN, face.uvNN
                );
                indices.push(
                    vcount + 2, vcount + 1, vcount,
                    vcount, vcount + 3, vcount + 2
                );
                vcount += 4;
            }

            // Down
            for(const face of mesher.renderFace[FaceDirection.DOWN] ? facesDown : facesDownAlways) {
                vertices.push(
                    x + face.localWidthMin, y + face.localDepthPos, z + face.localHeightMax,
                    x + face.localWidthMax, y + face.localDepthPos, z + face.localHeightMax,
                    x + face.localWidthMax, y + face.localDepthPos, z + face.localHeightMin,
                    x + face.localWidthMin, y + face.localDepthPos, z + face.localHeightMin,
                );
                bindata.push(
                    face.color, ao[FaceDirection.DOWN], face.fposNP, face.uvNP,
                    face.color, ao[FaceDirection.DOWN], face.fposPP, face.uvPP,
                    face.color, ao[FaceDirection.DOWN], face.fposPN, face.uvPN,
                    face.color, ao[FaceDirection.DOWN], face.fposNN, face.uvNN
                );
                indices.push(
                    vcount + 2, vcount + 1, vcount,
                    vcount, vcount + 3, vcount + 2
                );
                vcount += 4;
            }

            mesher.vertexCount = vcount;
        },
    };
}