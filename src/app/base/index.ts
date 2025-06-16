import { loadBlocks } from "./blocks";
export * from "./blocks";

export async function loadBase(isServer: boolean) {
    await loadBlocks(isServer);
}