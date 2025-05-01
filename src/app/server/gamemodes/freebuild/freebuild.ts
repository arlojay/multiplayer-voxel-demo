import { World } from "src/app/world";
import { UIButton, UIContainer, UIForm, UISection, UIText, UITextInput } from "../../../ui";
import { WorldGenerator } from "../../../worldGenerator";
import { Subscribe } from "../../events";
import { PlayerJoinEvent, PluginEvents, ServerLoadedEvent } from "../../pluginEvents";
import { ServerPeer } from "../../serverPeer";
import { ServerPlugin } from "../../serverPlugin";

interface ChatMessage {
    peer: ServerPeer;
    text: string;
}

export class Freebuild extends ServerPlugin {
    private world: World;
    private privateWorlds: Map<ServerPeer, World> = new Map;
    private messages: ChatMessage[];
    private chatUIs: Map<ServerPeer, UISection> = new Map;

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

        const chatUI = new UISection;
        const chatLogs = new UISection;
        chatLogs.style.display = "flex";
        chatLogs.style.flexDirection = "column";

        for(const message of this.messages) {
            const element = new UIText(message.text);
            chatLogs.addChild(element);
        }

        const chatForm = new UIForm;

        const chatInput = new UITextInput("Send a message to everyone...");
        chatInput.style.width = "16rem";
        chatForm.addChild(chatInput);

        const chatSubmit = new UIButton("Send");
        chatForm.addChild(chatSubmit);
        
        chatUI.addChild(chatLogs);
        chatUI.addChild(chatForm);

        chatForm.onSubmit(() => {
            for(const ui of this.chatUIs.values()) {
                const remoteChatLogs = ui.getElementByPath(chatUI.getPathOfElement(chatLogs)) as typeof chatLogs;
                const element = new UIText(chatInput.value);
                remoteChatLogs.addChild(element);
            }
        });

        this.chatUIs.set(event.peer, chatUI);
        event.peer.showUI(chatUI);
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