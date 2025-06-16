import { HashedInstanceRegistry } from "../registry";
import { Block } from "./block";

export const blockRegistry: HashedInstanceRegistry<Block, string> = new HashedInstanceRegistry;