import { UIButton, UISection, UIText } from "../../ui";
import { Subscribe } from "../events";
import { PeerJoinEvent, PluginEvents } from "../pluginEvents";
import { ServerPlugin } from "../serverPlugin";

export class DemoPlugin extends ServerPlugin {
    public readonly name = "demo";

    @Subscribe(PluginEvents.PEER_JOIN)
    public onPeerJoin(event: PeerJoinEvent) {        
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
    }
}