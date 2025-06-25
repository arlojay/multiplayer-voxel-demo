import { CHUNK_INC_SCL } from "../world/voxelGrid";
import { World } from "../world/world";
import { Block } from "./block";
import { BlockDataMemoizer } from "./blockDataMemoizer";

export type BlockStateSaveKey = `${string}#${string}`;
export type BlockStateSaveKeyPair = [ string, string ];

export function blockStateSaveKeyPairToString(pair: BlockStateSaveKeyPair): BlockStateSaveKey {
    return (pair[0] + "#" + pair[1]) as BlockStateSaveKey;
}
export function blockStateSaveKeyToPair(pair: BlockStateSaveKey): BlockStateSaveKeyPair {
    const index = pair.indexOf("#");
    return [ pair.slice(0, index), pair.slice(index + 1, pair.length) ];
}

export class BlockState {
    public x: number;
    public y: number;
    public z: number;
    public world: World;
    public block: Block;
    public state: string;

    public constructor();
    public constructor(block: Block, world: World, state: string, x: number, y: number, z: number);
    public constructor(block?: Block, world?: World, state?: string, x?: number, y?: number, z?: number) {
        this.block = block;
        this.world = world;
        this.state = state;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public getChunk() {
        return this.world.getChunk(this.x >> CHUNK_INC_SCL, this.y >> CHUNK_INC_SCL, this.z >> CHUNK_INC_SCL);
    }
    public getMemoizedId(memoizer: BlockDataMemoizer) {
        return memoizer.getMemoizedId(this.getSaveKey());
    }

    public setState(state: string, update = true) {
        this.state = state;
        this.world.setBlockState(this.x, this.y, this.z, this, update);
    }
    public getSaveKey(): BlockStateSaveKey {
        return `${this.block.id}#${this.state}`;
    }
    public getSaveKeyPair(): BlockStateSaveKeyPair {
        return [ this.block.id, this.state ];
    }

    public getType() {
        return this.block.states.get(this.state);
    }
}