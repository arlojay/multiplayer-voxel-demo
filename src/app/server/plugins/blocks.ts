import { Block } from "../../block/block";
import { BlockModel, BlockModelCuboid } from "../../block/blockModel";
import { DataLibrary } from "../../datalibrary/dataLibrary";
import { BASIC_COLLIDER } from "../../entity/collisionChecker";
import { BaseRegistries } from "../../synchronization/baseRegistries";
import { ServerPlugin } from "../serverPlugin";

export class BrickBlock extends Block {
    public readonly collider = BASIC_COLLIDER.collider;
    
    public async init(dataLibrary: DataLibrary) {
        const texture = await dataLibrary.getAsset("textures/brick1-texture.jpg").then(asset => asset.loadTexture());

        this.addState(
            "default",
            new BlockModel(
                new BlockModelCuboid()
                .createAllFaces()
                .setAllTextures(texture)
            ),
            BASIC_COLLIDER.collider
        );
    }
}

export class PlankBlock extends Block {
    public readonly collider = BASIC_COLLIDER.collider;
    
    public async init(dataLibrary: DataLibrary) {
        const texture = await dataLibrary.getAsset("textures/plank-texture.jpg").then(asset => asset.loadTexture());

        this.addState(
            "default",
            new BlockModel(
                new BlockModelCuboid()
                .createAllFaces()
                .setAllTextures(texture)
            ),
            BASIC_COLLIDER.collider
        );
    }
}

export class LeavesBlock extends Block {    
    public async init(dataLibrary: DataLibrary) {
        const texture = await dataLibrary.getAsset("textures/leaves2-texture.png").then(asset => asset.loadTexture());

        this.addState(
            "default",
            new BlockModel(
                new BlockModelCuboid()
                .createAllFaces()
                .setAllTextures(texture)
            )
            .setAoCasting(false)
            .setAoReceiving(false),
            BASIC_COLLIDER.collider
        );
    }
}

export class LogBlock extends Block {    
    public async init(dataLibrary: DataLibrary) {
        const textureSide = await dataLibrary.getAsset("textures/log-side-texture.jpg").then(asset => asset.loadTexture());
        const textureTop = await dataLibrary.getAsset("textures/log-top-texture.png").then(asset => asset.loadTexture());

        this.addState(
            "default",
            new BlockModel(
                new BlockModelCuboid()
                .createAllFaces()
                .setAllTextures(textureSide)
                .setUpTexture(textureTop)
                .setDownTexture(textureTop)
            ),
            BASIC_COLLIDER.collider
        );
    }
}

export class BlocksPlugin extends ServerPlugin {
    public name = "blocks";

    public async addContent(registries: BaseRegistries, dataLibrary: DataLibrary) {
        registries.blocks.register("brick", BrickBlock);
        registries.blocks.register("plank", PlankBlock);
        registries.blocks.register("leaves", LeavesBlock);
        registries.blocks.register("log", LogBlock);
    }
}