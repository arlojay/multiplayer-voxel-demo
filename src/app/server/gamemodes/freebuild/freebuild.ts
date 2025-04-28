import { UIButton, UIContainer, UIText } from "../../../ui";
import { Subscribe } from "../../events";
import { PlayerJoinEvent, PluginEvents } from "../../pluginEvents";
import { ServerPlugin } from "../../serverPlugin";

export class Freebuild extends ServerPlugin {
    @Subscribe(PluginEvents.PLAYER_JOIN)
    public onPlayerJoin(event: PlayerJoinEvent) {
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
    }
}