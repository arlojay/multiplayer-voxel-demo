import { HashedInstanceRegistry } from "../synchronization/registry";
import { World } from "../world/world";
import { Block } from "./block";
import { BlockState, BlockStateSaveKey, BlockStateSaveKeyPair, blockStateSaveKeyToPair } from "./blockState";

export class BlockRegistry extends HashedInstanceRegistry<Block, string> {
    public createState(stateKey: BlockStateSaveKey | BlockStateSaveKeyPair, x: number, y: number, z: number, world: World) {
        if(typeof stateKey == "string") stateKey = blockStateSaveKeyToPair(stateKey);

        return new BlockState(this.get(stateKey[0]), world, stateKey[1], x, y, z);
    }
    public getStateType(stateKey: BlockStateSaveKey | BlockStateSaveKeyPair) {
        if(typeof stateKey == "string") stateKey = blockStateSaveKeyToPair(stateKey);

        const type = this.get(stateKey[0])?.states.get(stateKey[1]);
        if(type == null) throw new ReferenceError("Cannot find state for " + stateKey.join("#"));

        return type;
    }
    public size() {
        return this.instances.size;
    }
}