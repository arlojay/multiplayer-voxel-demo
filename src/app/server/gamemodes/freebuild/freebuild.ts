import { World } from "src/app/world";
import { UIButton, UIContainer, UIText } from "../../../ui";
import { Subscribe } from "../../events";
import { PlayerJoinEvent, PluginEvents, ServerLoadedEvent } from "../../pluginEvents";
import { ServerPlugin } from "../../serverPlugin";
import { WorldGenerator } from "../../../worldGenerator";
import { ServerPeer } from "../../serverPeer";

export class Freebuild extends ServerPlugin {
    private world: World;
    private privateWorlds: Map<ServerPeer, World> = new Map;

    @Subscribe(PluginEvents.SERVER_LOADED)
    public async onLoad(event: ServerLoadedEvent) {
        const world = await event.server.createWorld("temp", false);
        world.setGenerator(new WorldGenerator(world));
        this.world = world;
    }

    @Subscribe(PluginEvents.PLAYER_JOIN)
    public onPlayerJoin(event: PlayerJoinEvent) {
        event.player.setWorld(this.world);
        event.player.respawn();
        
        const ui = new UIContainer;
        ui.style.alignSelf = "start";
        ui.style.justifySelf = "end";

        const text = new UIText("Hello world!");
        ui.addElement(text);

        const dismiss = new UIButton("Dismiss");
        ui.addElement(dismiss);

        let session = event.peer.showUI(ui);
        let i = 0;
        dismiss.onClick(() => {
            session.close();

            i++;
            text.text = "Clicked " + i + " time" + (i == 1 ? "" : "s");
            session = event.peer.showUI(ui);
        });

        this.createWorldSwitcherUI(event.peer);
    }

    private createWorldSwitcherUI(peer: ServerPeer) {
        const ui = new UIContainer;
        ui.style.alignSelf = "start";
        ui.style.justifySelf = "end";
        ui.style.marginTop = "1.5rem";

        const label = new UIText("=== Teleport to world ===");
        ui.style.display = "flex";
        ui.style.flexDirection = "column";
        ui.style.alignItems = "center";
        ui.style.textAlign = "right";
        ui.addElement(label);

        const tempWorldButton = new UIButton("Private World (deleted on disconnect)");
        tempWorldButton.style.display = "block";
        tempWorldButton.onClick(async () => {
            let world = this.privateWorlds.get(peer);
            if(world == null) {
                world = await this.server.createWorld("temp-" + peer.id, false);
                world.setGenerator(new WorldGenerator(world));
                this.privateWorlds.set(peer, world);
            }
            peer.sendToWorld(world);
            peer.player.respawn();
        });

        const mainWorldButton = new UIButton("Main World");
        mainWorldButton.style.display = "block";
        mainWorldButton.onClick(async () => {
            peer.sendToWorld(this.server.getDefaultWorld());
            peer.player.respawn();
        });

        ui.addElement(tempWorldButton);
        ui.addElement(mainWorldButton);

        const session = peer.showUI(ui);
    }
}