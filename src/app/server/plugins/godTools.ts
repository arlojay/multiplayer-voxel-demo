import { SetSelectedBlockPacket } from "../../packet";
import { UIButton, UIFieldset, UIGameBlock, UISection, UIText } from "../../ui";
import { Subscribe } from "../events";
import { PeerJoinEvent, PluginEvents } from "../pluginEvents";
import { ServerPeer } from "../serverPeer";
import { ServerPlugin } from "../serverPlugin";

export class GodToolsPlugin extends ServerPlugin {
    public name = "god-tools";

    @Subscribe(PluginEvents.PEER_JOIN)
    public onPeerJoin(event: PeerJoinEvent) {
        const ui = new UISection;
        ui.style.alignSelf = "start";
        ui.style.justifySelf = "end";

        const fieldset = new UIFieldset("GOD TOOLS");
        fieldset.style.textAlign = "center";
        fieldset.style.display = "flex";
        fieldset.style.flexDirection = "column";
        fieldset.style.alignItems = "center";

        fieldset.legend.style.color = "#ff8800";
        fieldset.legend.style.fontWeight = "bold";
        
        ui.addChild(fieldset);

        const getFlyButtonText = () => event.player.capabilities.canFly ? "Disable flying" : "Enable flying";

        const flyButton = new UIButton(getFlyButtonText());
        fieldset.addChild(flyButton);

        flyButton.onClick(() => {
            event.player.capabilities.canFly = !event.player.capabilities.canFly;
            event.serverPlayer.syncCapabilities();
            flyButton.setText(getFlyButtonText());
        })

        const itemShelfButton = new UIButton("Item Shelf");
        fieldset.addChild(itemShelfButton);

        itemShelfButton.onClick(() => {
            this.showItemShelf(event.peer);
        })
        
        event.peer.showUI(ui);
    }
    private showItemShelf(peer: ServerPeer) {
        const ui = new UISection;
        ui.style.alignSelf = "center";
        ui.style.justifySelf = "center";
        ui.style.background = "#0008";
        ui.style.padding = "1rem";
        ui.style.display = "flex";
        ui.style.flexDirection = "column";
        ui.style.alignContent = "center";
        
        const title = new UIText("Item shelf");
        title.style.fontSize = "2rem";
        title.style.display = "block";
        ui.addChild(title);
        
        const blockContainer = new UIFieldset("Blocks");
        ui.addChild(blockContainer);

        for(const block of this.server.registries.blocks.values()) {
            if(block.id == "air") continue;
            if(block.id == "color") continue;
            
            for(const state of block.states.values()) {
                const element = new UIGameBlock(state.saveKey);
                blockContainer.addChild(element);

                element.onClick(() => {
                    peer.sendPacket(new SetSelectedBlockPacket(state.saveKey));
                    session.close();
                })
            }
        }

        const closeButton = new UIButton("Close");
        closeButton.style.width = "50%";
        ui.addChild(closeButton);

        closeButton.onClick(() => {
            session.close();
        });
        
        const session = peer.showUI(ui);
    }
}