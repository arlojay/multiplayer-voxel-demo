import { BlockModel, SerializedBlockModel } from "./blockModel";
import { CustomVoxelCollider, SerializedCustomVoxelCollider } from "../entity/collisionChecker";
import { DataLibrary } from "../data/dataLibrary";
import { RegistryObject } from "../registry";

export interface SerializedBlock {
    id: string;
    walkThrough: boolean;
    raycastTarget: boolean;
    collider: SerializedCustomVoxelCollider;
    model: SerializedBlockModel;
}

export abstract class Block extends RegistryObject<string> {
    public abstract readonly collider: CustomVoxelCollider;

    public model: BlockModel = null;
    public readonly walkThrough: boolean = false;
    public readonly raycastTarget: boolean = true;

    public async init(dataLibrary: DataLibrary) {
        this.model = await this.createModel(dataLibrary);
    }

    abstract createModel(dataLibrary: DataLibrary): Promise<BlockModel>;

    public serialize(): SerializedBlock {
        return {
            id: this.id,
            walkThrough: this.walkThrough,
            raycastTarget: this.raycastTarget,
            collider: this.collider.serialize(),
            model: this.model.serialize()
        }
    }
}

export function createDeserializedBlockClass(serializedBlock: SerializedBlock) {
    return class extends Block {
        public collider: CustomVoxelCollider = CustomVoxelCollider.deserialize(serializedBlock.collider);
        public readonly walkThrough = serializedBlock.walkThrough;
        public readonly raycastTarget = serializedBlock.raycastTarget;

        public async createModel(dataLibrary: DataLibrary) {
            return await BlockModel.deserialize(serializedBlock.model, dataLibrary);
        }
    }
}