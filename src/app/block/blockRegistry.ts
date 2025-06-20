import { HashedInstanceRegistry } from "../registry";
import { Block } from "./block";

export class BlockRegistry extends HashedInstanceRegistry<Block, string> {
    constructor() {
        super();
    }
}