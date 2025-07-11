import { UIButton, UIForm, UIText } from "../../ui";
import { World } from "../../world/world";
import { WorldGenerator } from "../../world/worldGenerator";
import { Subscribe } from "../events";
import { PeerJoinEvent, PluginEvents } from "../pluginEvents";
import { ServerPeer } from "../serverPeer";
import { ServerPlugin } from "../serverPlugin";

export class FreebuildPlugin extends ServerPlugin {
    public readonly name = "freebuild";

    private privateWorlds: Map<ServerPeer, World> = new Map;

    @Subscribe(PluginEvents.PEER_JOIN)
    public onPeerJoin(event: PeerJoinEvent) {
        const peer = event.peer;

        const ui = new UIForm;
        ui.style.alignSelf = "start";
        ui.style.justifySelf = "end";
        ui.style.marginTop = "1.5rem";

        const label = new UIText("=== Teleport to world ===");
        ui.style.display = "flex";
        ui.style.flexDirection = "column";
        ui.style.alignItems = "center";
        ui.style.textAlign = "right";
        ui.addChild(label);

        const tempWorldButton = new UIButton("Private World (deleted on disconnect)");
        tempWorldButton.style.display = "block";
        tempWorldButton.onClick(async () => {
            let world = this.privateWorlds.get(peer);
            if(world == null) {
                world = await this.server.getWorld("temp-" + peer.id, false);
                world.setGenerator(new WorldGenerator(world));
                this.privateWorlds.set(peer, world);
            }
            peer.sendToWorld(world);
            peer.serverPlayer.respawn();
        });

        const mainWorldButton = new UIButton("Main World");
        mainWorldButton.style.display = "block";
        mainWorldButton.onClick(async () => {
            peer.sendToWorld(this.server.getDefaultWorld());
            peer.serverPlayer.respawn();
        });

        ui.addChild(tempWorldButton);
        ui.addChild(mainWorldButton);

        peer.createUISession(ui).open();
    }
}