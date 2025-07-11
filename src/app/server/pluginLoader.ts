import { BannerPlugin } from "./plugins/banner";
import { BlocksPlugin } from "./plugins/blocks";
import { ChatPlugin } from "./plugins/chat";
import { DemoPlugin } from "./plugins/demo";
import { FreebuildPlugin } from "./plugins/freebuild";
import { GodToolsPlugin } from "./plugins/godTools";
import { InventoryPlugin } from "./plugins/inventory";
import { TerrainPlugin } from "./plugins/terrain";
import { ServerPlugin } from "./serverPlugin";

// TODO: dynamic plugin loading
const pluginList = new Map<string, () => ServerPlugin>([
    ["freebuild", () => new FreebuildPlugin],
    ["chat", () => new ChatPlugin],
    ["terrain", () => new TerrainPlugin],
    ["demo", () => new DemoPlugin],
    ["game code banner", () => new BannerPlugin],
    ["god-tools", () => new GodToolsPlugin],
    ["blocks", () => new BlocksPlugin],
    ["inventory", () => new InventoryPlugin],
])

export class PluginLoader {
    public static getPluginList() {
        return new Set(pluginList.keys());
    }
    public static createPlugin(name: string) {
        const factory = pluginList.get(name);
        if(factory == null) throw new ReferenceError("Plugin " + name + " does not exist");
        return factory();
    }
}