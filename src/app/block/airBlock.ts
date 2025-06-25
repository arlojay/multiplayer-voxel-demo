import { DataLibrary } from "../datalibrary/dataLibrary";
import { CustomVoxelCollider } from "../entity/collisionChecker";
import { Block } from "./block";
import { BlockModel } from "./blockModel";

export class AirBlock extends Block {    
    public async init(dataLibrary: DataLibrary) {
        const model = new BlockModel;
        model.aoCasting = false;
        model.aoReceiving = false;
        model.cullable = true;
        model.opaque = false;

        this.addState(
            "default",
            model,
            new CustomVoxelCollider,
            {
                raycastTarget: false,
                walkThrough: true
            }
        )
    }
}