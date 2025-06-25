import { DataLibrary } from "../datalibrary/dataLibrary";
import { DataLibraryAssetReference } from "../datalibrary/dataLibraryAssetTypes";
import { CustomVoxelCollider } from "../entity/collisionChecker";
import { RegistryObject } from "../synchronization/registry";
import { World } from "../world/world";
import { BlockModel } from "./blockModel";
import { BlockState } from "./blockState";
import { BlockStateOptions, BlockStateType, SerializedBlockStateType } from "./blockStateType";

export interface SerializedBlock {
    id: string;
    states: Record<string, SerializedBlockStateType>;
    usedTextures: DataLibraryAssetReference[];
}

export abstract class Block extends RegistryObject<string> {
    public states: Map<string, BlockStateType> = new Map;

    public abstract init(dataLibrary: DataLibrary): Promise<void>;

    public serialize(): SerializedBlock {
        const serializedStates: Record<string, SerializedBlockStateType> = {};
        const usedTextures: DataLibraryAssetReference[] = new Array;

        for(const [ state, type ] of this.states.entries()) {
            serializedStates[state] = type.serialize(usedTextures);
        }
        return {
            id: this.id,
            states: serializedStates,
            usedTextures
        };
    }
    protected addState(state: string, model: BlockModel, collider: CustomVoxelCollider, options?: BlockStateOptions) {
        const type = new BlockStateType(this, state, model, collider, options);
        this.states.set(type.state, type);
        return type;
    }
    public createState(state: string, world: World, x: number, y: number, z: number) {
        return new BlockState(this, world, state, x, y, z);
    }
}

export function createDeserializedBlockClass(serializedBlock: SerializedBlock) {
    return class extends Block {
        public async init(dataLibrary: DataLibrary) {
            for(const state in serializedBlock.states) {
                const type = await BlockStateType.deserialize(this, serializedBlock.states[state], serializedBlock.usedTextures, dataLibrary);
                this.states.set(state, type);
            }
        }
    }
}