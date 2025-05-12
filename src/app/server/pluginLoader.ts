import { BannerPlugin } from "./plugins/banner";
import { ChatPlugin } from "./plugins/chat";
import { DemoPlugin } from "./plugins/demo";
import { FreebuildPlugin } from "./plugins/freebuild";
import { TerrainPlugin } from "./plugins/terrain";
import { ServerPlugin } from "./serverPlugin";

// TODO: dynamic plugin loading
const pluginList = new Map<string, () => ServerPlugin>([
    ["freebuild", () => new FreebuildPlugin],
    ["chat", () => new ChatPlugin],
    ["terrain", () => new TerrainPlugin],
    ["demo", () => new DemoPlugin],
    ["game code banner", () => new BannerPlugin],
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