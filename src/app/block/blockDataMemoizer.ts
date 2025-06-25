import { compileCollider, CompiledCustomVoxelCollider, CustomVoxelCollider } from "../entity/collisionChecker";
import { TextureAtlas } from "../texture/textureAtlas";
import { BlockOcclusionType, CustomVoxelMesh } from "../world/voxelMesher";
import { BlockModel, compileBlockModel } from "./blockModel";
import { BlockRegistry } from "./blockRegistry";
import { BlockStateSaveKey, blockStateSaveKeyPairToString } from "./blockState";

export class BlockDataMemoizer {
    public blockRegistry: BlockRegistry;

    public memoizedStates: BlockStateSaveKey[] = new Array;
    public memoizedIds: Map<BlockStateSaveKey, number> = new Map;
    
    public colliders: CompiledCustomVoxelCollider[] = new Array;
    public ignoreColliders: boolean[] = new Array;
    public ignoreRaycasters: boolean[] = new Array;

    public customMeshes: CustomVoxelMesh[] = new Array;
    public aoContributionAmounts: number[] = new Array;
    public aoReceivingBlocks: number[] = new Array;
    public blockOcclusionTypes: BlockOcclusionType[] = new Array;
    public cullableBlocks: boolean[] = new Array;
    public renderedBlocks: boolean[] = new Array;

    public isServer: boolean;
    public memoized = false;

    constructor(blockRegistry: BlockRegistry, isServer: boolean) {
        this.blockRegistry = blockRegistry;
        this.isServer = isServer;
    }
    public async memoize(textureAtlas?: TextureAtlas) {
        if(this.memoized) throw new ReferenceError("Cannot re-memoize blocks!");
        this.memoized = true;

        for(const block of this.blockRegistry.values()) {
            for(const state of block.states.values()) {
                this.addCustomVoxelCollider(state.collider);
                if(!this.isServer) await this.addCustomVoxelMesh(state.model, textureAtlas);

                const memoizedId = this.memoizedStates.length;
                const stateKey = blockStateSaveKeyPairToString([ block.id, state.state ])

                this.memoizedStates.push(stateKey);
                this.memoizedIds.set(stateKey, memoizedId);
            }
        }

        this.aoContributionAmounts = new Int32Array(this.aoContributionAmounts) as unknown as number[];
        this.aoReceivingBlocks = new Int32Array(this.aoReceivingBlocks) as unknown as number[];
    }
    
    private addCustomVoxelCollider(collider: CustomVoxelCollider) {
        const { colliderIgnored, raycastIgnored, compiledCollider } = compileCollider(collider);
    
        this.ignoreColliders.push(colliderIgnored);
        this.ignoreRaycasters.push(raycastIgnored);
        this.colliders.push(compiledCollider);
    }
    
    public async addCustomVoxelMesh(model: BlockModel, textureAtlas: TextureAtlas) {
        const mesh = await compileBlockModel(model, textureAtlas);

        this.customMeshes.push(mesh);
        this.aoContributionAmounts.push(mesh.aoCasting ? 1 : 0);
        this.aoReceivingBlocks.push(mesh.aoReceiving ? 1 : 0);
        this.blockOcclusionTypes.push(mesh.opaque ? BlockOcclusionType.OPAQUE : BlockOcclusionType.NONE);
        this.cullableBlocks.push(mesh.cullable);
        this.renderedBlocks.push(model.cuboids.length > 0);
    }

    public getMemoizedId(blockStateKey: BlockStateSaveKey) {
        return this.memoizedIds.get(blockStateKey);
    }
    public getStateKey(memoizedId: number) {
        return this.memoizedStates[memoizedId];
    }
}