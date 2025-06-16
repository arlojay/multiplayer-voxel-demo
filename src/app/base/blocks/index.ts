import { addCustomVoxelMesh } from "../../voxelMesher";
import { blockRegistry } from "../../block/blockRegistry";
import { compileBlockModel } from "../../block/blockModel";
import { TextureAtlas } from "../../texture/textureAtlas";
import { terrainMap } from "../../shaders/terrain";
import { NearestFilter } from "three";
import { addCustomVoxelCollider } from "../../entity/collisionChecker";

export * from "./logBlock";

export async function loadBlocks(isServer: boolean) {
    blockRegistry.freeze();
    const promises: Promise<void>[] = new Array;

    blockRegistry.makeInstances();

    for(const blockId of blockRegistry.keys()) {
        const block = blockRegistry.get(blockId);
        console.log(block);
        promises.push(block.init(isServer));
    }

    await Promise.all(promises);

    const textureAtlas = new TextureAtlas;
    if(!isServer) {
        for(const block of blockRegistry.values()) {
            for(const texture of block.model.getUsedTextures()) {
                textureAtlas.addTexture(texture);
            }
        }
        textureAtlas.build();
        textureAtlas.builtTexture.magFilter = NearestFilter;
        textureAtlas.builtTexture.colorSpace = "srgb";
        terrainMap.value = textureAtlas.builtTexture;
    }
    
    for(const block of blockRegistry.values()) {
        if(!isServer) addCustomVoxelMesh(compileBlockModel(block.model, textureAtlas));
        addCustomVoxelCollider(block.collider);
    }
    console.log(blockRegistry);
}