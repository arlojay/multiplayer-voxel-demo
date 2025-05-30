import { UIButton, UISection, UIText } from "../../ui";
import { Subscribe } from "../events";
import { DatabaseObject, DatabaseObjectStore, DatabaseView } from "../pluginConfig";
import { PeerJoinEvent, PluginEvents, ServerLoadedEvent } from "../pluginEvents";
import { ServerPlugin } from "../serverPlugin";
import { ServerUI } from "../serverUI";

interface PlayerClicksEntry {
    username: string;
    clicks: number;
}

export class DemoPlugin extends ServerPlugin {
    public readonly name = "demo";
    private db: DatabaseView;
    private clicksStore: DatabaseObjectStore<"username", PlayerClicksEntry>;

    @Subscribe(PluginEvents.SERVER_LOADED)
    public async onServerLoad(event: ServerLoadedEvent) {
        this.db = await this.server.data.openPluginDatabase(this);
        this.clicksStore = await this.db.objectStore("clicks", "username");
    }

    @Subscribe(PluginEvents.PEER_JOIN)
    public async onPeerJoin(event: PeerJoinEvent) {
        const ui = new UISection;
        ui.style.alignSelf = "start";
        ui.style.justifySelf = "end";

        const entry = this.clicksStore.has(event.peer.username)
            ? await this.clicksStore.get(event.peer.username)
            : await this.clicksStore.create(event.peer.username, {
                clicks: 0
            });
        
        const text = new UIText("");
        ui.addChild(text);
        let session: ServerUI = null;

        const updateClicks = () => {
            session?.close();
            text.setText(entry.data.clicks + " clicks");
            session = event.peer.showUI(ui);
        }

        const button = new UIButton("Add click");
        ui.addChild(button);
        button.onClick(() => {
            entry.data.clicks++;
            entry.save();
            
            updateClicks();
        });
        
        updateClicks();
    }
}