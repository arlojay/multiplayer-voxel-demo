import { HashedInstanceRegistry } from "../registry";
import { World } from "../world";
import { Block } from "./block";
import { BlockState, BlockStateSaveKey, BlockStateSaveKeyPair, blockStateSaveKeyToPair } from "./blockState";

export class BlockRegistry extends HashedInstanceRegistry<Block, string> {
    public createState(stateKey: BlockStateSaveKey | BlockStateSaveKeyPair, x: number, y: number, z: number, world: World) {
        if(typeof stateKey == "string") stateKey = blockStateSaveKeyToPair(stateKey);

        return new BlockState(this.get(stateKey[0]), world, stateKey[1], x, y, z);
    }
    public getStateType(stateKey: BlockStateSaveKey | BlockStateSaveKeyPair) {
        if(typeof stateKey == "string") stateKey = blockStateSaveKeyToPair(stateKey);

        return this.get(stateKey[0]).states.get(stateKey[1]);
    }
}