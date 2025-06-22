import { UIButton, UIFieldset, UISection, UISpacer, UIText } from "../../ui";
import { Subscribe } from "../events";
import { PeerJoinEvent, PluginEvents } from "../pluginEvents";
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
        
        event.peer.showUI(ui);
    }
}