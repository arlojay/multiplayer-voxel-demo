import { Box3, Texture, Vector2, Vector3 } from "three";
import { CustomVoxelMesh, FaceDirection, packVec2, VoxelMesher } from "../voxelMesher";
import { clamp, map } from "../math";
import { TextureAtlas } from "../texture/textureAtlas";

export class BlockCuboidFace {
    texture: Texture;
    cull = true;
    uvMin = new Vector2(0, 0);
    uvMax = new Vector2(16, 16);
    uvRotation = 0;

    public setTexture(texture: Texture) {
        if(this.texture == null) {
            this.texture = texture;
            this.uvMin.set(0, 0);
            this.uvMax.set(texture.image.width, texture.image.height);
            return;
        }

        const sizeA = new Vector2(this.texture.image.width, this.texture.image.height);
        const sizeB = new Vector2(texture.image.width, texture.image.height).divide(sizeA);
        this.uvMin.multiply(sizeB).round();
        this.uvMax.multiply(sizeB).round();

        this.texture = texture;
    }
}
export class BlockModelCuboid {
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

    public setNorthTexture(texture: Texture) {
        this.north ??= new BlockCuboidFace;
        this.north.setTexture(texture);
        return this;
    }
    public setEastTexture(texture: Texture) {
        this.east ??= new BlockCuboidFace;
        this.east.setTexture(texture);
        return this;
    }
    public setSouthTexture(texture: Texture) {
        this.south ??= new BlockCuboidFace;
        this.south.setTexture(texture);
        return this;
    }
    public setWestTexture(texture: Texture) {
        this.west ??= new BlockCuboidFace;
        this.west.setTexture(texture);
        return this;
    }
    public setUpTexture(texture: Texture) {
        this.up ??= new BlockCuboidFace;
        this.up.setTexture(texture);
        return this;
    }
    public setDownTexture(texture: Texture) {
        this.down ??= new BlockCuboidFace;
        this.down.setTexture(texture);
        return this;
    }

    public setAllTextures(texture: Texture) {
        this.getAllFaces().forEach(face => face.setTexture(texture));
        return this;
    }
    public getUsedTextures(): Texture[] {
        const textures: Set<Texture> = new Set;
        for(const face of this.getAllFaces()) textures.add(face.texture);
        return Array.from(textures);
    }
}
export abstract class BlockModel {
    public cuboids: BlockModelCuboid[] = new Array;

    public abstract aoCasting: boolean;
    public abstract aoReceiving: boolean;
    public abstract opaque: boolean;
    public abstract cullable: boolean;

    public getUsedTextures(): Texture[] {
        const textures: Set<Texture> = new Set;
        for(const cuboid of this.cuboids) {
            for(const face of cuboid.getAllFaces()) {
                textures.add(face.texture);
            }
        }
        return Array.from(textures);
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
    uvNN: number;
    uvNP: number;
    uvPN: number;
    uvPP: number;
    fposNN: number;
    fposNP: number;
    fposPN: number;
    fposPP: number;
}

function compileFaceUVs(face: BlockCuboidFace, textureAtlas: TextureAtlas) {
    const entry = textureAtlas.getTexturePosition(face.texture);

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

export function compileBlockModel(model: BlockModel, textureAtlas: TextureAtlas): CustomVoxelMesh {
    const faces: CompiledModelFace[] = new Array;

    for(const cuboid of model.cuboids) {
        if(cuboid.north != null) faces.push({
            direction: FaceDirection.NORTH,
            cull: cuboid.north.cull,
            localWidthMin: cuboid.size.min.x,
            localWidthMax: cuboid.size.max.x,
            localHeightMin: cuboid.size.min.y,
            localHeightMax: cuboid.size.max.y,
            localDepthPos: cuboid.size.min.z,
            ...compileFaceUVs(cuboid.north, textureAtlas),
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
            ...compileFaceUVs(cuboid.south, textureAtlas),
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
            ...compileFaceUVs(cuboid.east, textureAtlas),
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
            ...compileFaceUVs(cuboid.west, textureAtlas),
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
            ...compileFaceUVs(cuboid.up, textureAtlas),
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
            ...compileFaceUVs(cuboid.down, textureAtlas),
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

    console.log(facesNorth, facesSouth, facesEast, facesWest, facesUp, facesDown);

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
                    color, ao[FaceDirection.WEST], face.fposNP, face.uvNP,
                    color, ao[FaceDirection.WEST], face.fposPP, face.uvPP,
                    color, ao[FaceDirection.WEST], face.fposPN, face.uvPN,
                    color, ao[FaceDirection.WEST], face.fposNN, face.uvNN
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
                    color, ao[FaceDirection.EAST], face.fposNP, face.uvNP,
                    color, ao[FaceDirection.EAST], face.fposPP, face.uvPP,
                    color, ao[FaceDirection.EAST], face.fposPN, face.uvPN,
                    color, ao[FaceDirection.EAST], face.fposNN, face.uvNN
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
                    color, ao[FaceDirection.SOUTH], face.fposNP, face.uvNP,
                    color, ao[FaceDirection.SOUTH], face.fposPP, face.uvPP,
                    color, ao[FaceDirection.SOUTH], face.fposPN, face.uvPN,
                    color, ao[FaceDirection.SOUTH], face.fposNN, face.uvNN
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
                    color, ao[FaceDirection.NORTH], face.fposNP, face.uvNP,
                    color, ao[FaceDirection.NORTH], face.fposPP, face.uvPP,
                    color, ao[FaceDirection.NORTH], face.fposPN, face.uvPN,
                    color, ao[FaceDirection.NORTH], face.fposNN, face.uvNN
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
                    color, ao[FaceDirection.UP], face.fposNP, face.uvNP,
                    color, ao[FaceDirection.UP], face.fposPP, face.uvPP,
                    color, ao[FaceDirection.UP], face.fposPN, face.uvPN,
                    color, ao[FaceDirection.UP], face.fposNN, face.uvNN
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
                    color, ao[FaceDirection.DOWN], face.fposNP, face.uvNP,
                    color, ao[FaceDirection.DOWN], face.fposPP, face.uvPP,
                    color, ao[FaceDirection.DOWN], face.fposPN, face.uvPN,
                    color, ao[FaceDirection.DOWN], face.fposNN, face.uvNN
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