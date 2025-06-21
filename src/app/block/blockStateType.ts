import { DataLibrary } from "../data/dataLibrary";
import { DataLibraryAssetReference } from "../data/dataLibraryAssetTypes";
import { CustomVoxelCollider, SerializedCustomVoxelCollider } from "../entity/collisionChecker";
import { Block } from "./block";
import { BlockModel, SerializedBlockModel } from "./blockModel";
import { BlockStateSaveKey, BlockStateSaveKeyPair } from "./blockState";

export type SerializedBlockStateType = [
    string, //state
    SerializedBlockModel, //model
    SerializedCustomVoxelCollider, //collider
    boolean, //walkThrough
    boolean, //raycastTarget
]
export interface BlockStateOptions {
    walkThrough?: boolean;
    raycastTarget?: boolean;
}

export class BlockStateType {
    public static async deserialize(block: Block, serialized: SerializedBlockStateType, usedTextures: DataLibraryAssetReference[], dataLibrary: DataLibrary) {
        return new BlockStateType(
            block,
            serialized[0],
            await BlockModel.deserialize(serialized[1], usedTextures, dataLibrary),
            CustomVoxelCollider.deserialize(serialized[2]),
            {
                walkThrough: serialized[3],
                raycastTarget: serialized[4]
            }
        );
    }

    public readonly collider: CustomVoxelCollider;

    public readonly block: Block;
    public readonly model: BlockModel = null;
    public readonly state: string;
    public readonly walkThrough: boolean = false;
    public readonly raycastTarget: boolean = true;
    public readonly saveKey: BlockStateSaveKey;
    public readonly saveKeyPair: BlockStateSaveKeyPair;

    public constructor(block: Block, state: string, model: BlockModel, collider: CustomVoxelCollider, options?: BlockStateOptions) {
        options ??= {};
        options.raycastTarget ??= true;
        options.walkThrough ??= false;

        this.block = block;
        this.state = state;
        this.model = model;
        this.collider = collider;
        this.saveKey = `${this.block.id}#${this.state}`;
        this.saveKeyPair = [ this.block.id, this.state ];

        this.raycastTarget = options.raycastTarget;
        this.walkThrough = options.walkThrough;
    }

    public serialize(usedTextures: DataLibraryAssetReference[]): SerializedBlockStateType {
        return [
            this.state,
            this.model.serialize(usedTextures),
            this.collider.serialize(),
            this.walkThrough,
            this.raycastTarget
        ]
    }
}