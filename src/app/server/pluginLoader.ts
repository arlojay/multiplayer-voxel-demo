import { Freebuild } from "./gamemodes/freebuild";
import { ServerPlugin } from "./serverPlugin";

// TODO: dynamic plugin loading
const pluginList: Map<string, () => ServerPlugin> = new Map([
    ["freebuild", () => new Freebuild]
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