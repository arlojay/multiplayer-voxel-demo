import { compileCollider, CompiledCustomVoxelCollider, CustomVoxelCollider } from "../entity/collisionChecker";
import { TextureAtlas } from "../texture/textureAtlas";
import { CustomVoxelMesh } from "../voxelMesher";
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
    public aoCastingBlocks: boolean[] = new Array;
    public aoReceivingBlocks: boolean[] = new Array;
    public opaqueBlocks: boolean[] = new Array;
    public cullableBlocks: boolean[] = new Array;
    public renderedBlocks: boolean[] = new Array;
    public isServer: boolean;

    constructor(blockRegistry: BlockRegistry, isServer: boolean) {
        this.blockRegistry = blockRegistry;
        this.isServer = isServer;
    }
    public async memoize(textureAtlas?: TextureAtlas) {
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
        this.aoCastingBlocks.push(mesh.aoCasting);
        this.aoReceivingBlocks.push(mesh.aoReceiving);
        this.opaqueBlocks.push(mesh.opaque);
        this.cullableBlocks.push(mesh.cullable);
        this.renderedBlocks.push(model.cuboids.length > 0);
    }

    public getMemoizedId(blockStateKey: BlockStateSaveKey) {
        return this.memoizedIds.get(blockStateKey);
    }
}