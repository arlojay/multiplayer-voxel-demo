import { HashedRegistryKey } from "../registry";
import { BlockModel } from "./blockModel";
import { CustomVoxelCollider } from "../entity/collisionChecker";

export abstract class Block {
    public abstract readonly id: HashedRegistryKey<string>;
    public abstract readonly collider: CustomVoxelCollider;

    public model: BlockModel = null;
    public readonly walkThrough = false;
    public readonly raycastTarget = true;

    public constructor() {
        
    }

    public async init(isServer: boolean) {
        if(!isServer) this.model = await this.createModel();
    }

    abstract createModel(): Promise<BlockModel>;
}