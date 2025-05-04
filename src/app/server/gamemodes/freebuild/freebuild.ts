import { World } from "src/app/world";
import { UIButton, UIContainer, UIForm, UISection, UIText, UITextInput } from "../../../ui";
import { WorldGenerator } from "../../../worldGenerator";
import { Subscribe } from "../../events";
import { PeerJoinEvent, PeerLeaveEvent, PluginEvents, ServerLoadedEvent } from "../../pluginEvents";
import { ServerPeer } from "../../serverPeer";
import { ServerPlugin } from "../../serverPlugin";
import { ChatUIManager } from "./chatUIManager";

export class Freebuild extends ServerPlugin {
    private world: World;
    private privateWorlds: Map<ServerPeer, World> = new Map;
    private chatUIManager: ChatUIManager = new ChatUIManager;

    @Subscribe(PluginEvents.SERVER_LOADED)
    public async onLoad(event: ServerLoadedEvent) {
        const world = await event.server.createWorld("temp", false);
        world.setGenerator(new WorldGenerator(world));
        this.world = world;
    }

    @Subscribe(PluginEvents.PEER_JOIN)
    public onPeerJoin(event: PeerJoinEvent) {
        event.player.setWorld(this.world);
        event.player.respawn();
        
        const ui = new UISection;
        ui.style.alignSelf = "start";
        ui.style.justifySelf = "end";

        const text = new UIText("Hello world!");
        ui.addChild(text);

        const dismiss = new UIButton("Dismiss");
        ui.addChild(dismiss);

        let session = event.peer.showUI(ui);
        let i = 0;
        dismiss.onClick(() => {
            session.close();

            i++;
            text.text = "Clicked " + i + " time" + (i == 1 ? "" : "s");
            session = event.peer.showUI(ui);
        });

        this.createWorldSwitcherUI(event.peer);

        this.chatUIManager.onPeerJoin(event.peer);
    }
    
    @Subscribe(PluginEvents.PEER_LEAVE)
    public onPeerLeave(event: PeerLeaveEvent) {
        this.chatUIManager.onPeerLeave(event.peer);
    }

    private createWorldSwitcherUI(peer: ServerPeer) {
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

        ui.addChild(tempWorldButton);
        ui.addChild(mainWorldButton);

        const session = peer.showUI(ui);
    }
}