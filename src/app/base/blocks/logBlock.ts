import { CustomVoxelCollider, CustomVoxelColliderBox } from "../../entity/collisionChecker";
import { Block } from "../../block/block";
import { BlockModel, BlockModelCuboid } from "../../block/blockModel";
import { blockRegistry } from "../../block/blockRegistry";
import { Texture, TextureLoader, Vector3 } from "three";

export class LogBlockModel extends BlockModel {
    public aoCasting = true;
    public aoReceiving = true;
    public opaque = true;
    public cullable = true;

    constructor(topTexture: Texture, sideTexture: Texture) {
        super();

        this.cuboids.push(new BlockModelCuboid()
            .createAllFaces()
            
            .setAllTextures(sideTexture)

            .setUpTexture(topTexture)
            .setDownTexture(topTexture)
        );
    }
}

export class LogBlock extends Block {
    public static readonly id = blockRegistry.register("log", this);
    public readonly id = LogBlock.id;
    public readonly collider = new CustomVoxelCollider(
        new CustomVoxelColliderBox(
            new Vector3(0, 0, 0),
            new Vector3(1, 1, 1),
        ),
    );
    
    public async createModel() {
        const top = await new TextureLoader().loadAsync("assets/textures/log-top-texture.png");
        const side = await new TextureLoader().loadAsync("assets/textures/log-side-texture.jpg");
        return new LogBlockModel(top, side);
    }
}