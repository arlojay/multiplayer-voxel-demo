import { BlockRegistry } from "../block/blockRegistry";

export interface BaseRegistries {
    blocks: BlockRegistry;
}

let instance: BaseRegistries;
export function setCurrentBaseRegistries(registries: BaseRegistries) {
    instance = registries;
}
export function getCurrentBaseRegistries() {
    return instance;
}