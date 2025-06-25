import { Color, ColorRepresentation, Vector3 } from "three";
import { DataLibrary } from "../datalibrary/dataLibrary";
import { CustomVoxelCollider, CustomVoxelColliderBox } from "../entity/collisionChecker";
import { clamp } from "../math";
import { Block } from "./block";
import { BlockModel, BlockModelCuboid } from "./blockModel";

export class ColorBlock extends Block {
    public static getClosestColor(color: ColorRepresentation) {
        const colorInstance = new Color(color);
        colorInstance.r = clamp(Math.round(colorInstance.r * 15) / 15, 0, 1);
        colorInstance.g = clamp(Math.round(colorInstance.g * 15) / 15, 0, 1);
        colorInstance.b = clamp(Math.round(colorInstance.b * 15) / 15, 0, 1);
        return colorInstance.getHexString();
    }

    public async init(dataLibrary: DataLibrary) {
        const collider = new CustomVoxelCollider(
            new CustomVoxelColliderBox(
                new Vector3(0, 0, 0),
                new Vector3(1, 1, 1)
            )
        );

        const texture = await dataLibrary.getAsset("textures/color-block.png").then(texture => texture.loadTexture());

        for(let r = 0; r < 16; r++) {
            for(let g = 0; g < 16; g++) {
                for(let b = 0; b < 16; b++) {
                    const color = new Color;
                    color.r = r / 15;
                    color.g = g / 15;
                    color.b = b / 15;

                    this.addState(
                        color.getHexString(),
                        new BlockModel(
                            new BlockModelCuboid()
                            .createAllFaces()
                            .setAllTextures(texture)
                            .setAllColors(color.clone().lerp(new Color(0xffffff), 0.1))
                        ),
                        collider
                    )
                }
            }
        }
    }
}