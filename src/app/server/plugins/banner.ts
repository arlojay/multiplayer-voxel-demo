import { UISection, UIText } from "../../ui";
import { Subscribe } from "../events";
import { PeerJoinEvent, PluginEvents } from "../pluginEvents";
import { ServerPlugin } from "../serverPlugin";

export class BannerPlugin extends ServerPlugin {
    public readonly name = "banner";

    @Subscribe(PluginEvents.PEER_JOIN)
    public onPeerJoin(event: PeerJoinEvent) {        
        const ui = new UISection;
        ui.style.alignSelf = "start";
        ui.style.justifySelf = "center";

        const text = new UIText(this.server.launchOptions.peerId);
        ui.addChild(text);
        text.style.fontSize = "2rem";

        let session = event.peer.showUI(ui);
    }
}