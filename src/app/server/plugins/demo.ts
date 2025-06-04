import { UIButton, UISection, UIText } from "../../ui";
import { Subscribe } from "../events";
import { DatabaseObjectStore, DatabaseView } from "../pluginConfig";
import { PeerJoinEvent, PlaceBlockEvent, PluginEvents, ServerLoadedEvent, ServerTickEvent } from "../pluginEvents";
import { ServerPlugin } from "../serverPlugin";
import { ServerUI } from "../serverUI";
import { TextEntity } from "../../entity/impl";
import hsl from "color-space/hsl";

interface PlayerClicksEntry {
    username: string;
    clicks: number;
}

interface FloatingDemoText {
    entity: TextEntity;
    birth: number;
}

export class DemoPlugin extends ServerPlugin {
    public readonly name = "demo";
    private db: DatabaseView;
    private clicksStore: DatabaseObjectStore<"username", PlayerClicksEntry>;
    private textBoxes: Set<FloatingDemoText> = new Set;

    @Subscribe(PluginEvents.SERVER_LOADED)
    public async onServerLoad(event: ServerLoadedEvent) {
        this.db = await this.server.data.openPluginDatabase(this);
        this.clicksStore = await this.db.objectStore("clicks", "username");

        const defaultWorld = this.server.getDefaultWorld();
        const int = 20;
        for(let x = -100; x < 100; x += int) {
            for(let z = -100; z < 100; z += int) {
                const textEntity = defaultWorld.spawnEntity(TextEntity);
                textEntity.position.set(x, 10, z);
                textEntity.text = "oh... hello..!! (" + x + ", " + z + ")";
                textEntity.size = 1;
            }
        }
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

    @Subscribe(PluginEvents.SERVER_TICK)
    public onTick(event: ServerTickEvent) {
        for(const textBox of this.textBoxes) {
            if(this.server.time - textBox.birth > 5000) {
                textBox.entity.remove();
                this.textBoxes.delete(textBox);
                continue;
            }

            const hue = (this.server.time - textBox.birth) / 5000 * 360;

            textBox.entity.color.set(...hsl.rgb([ hue, 100, 70 ]), 0xff);
            textBox.entity.background.set(...hsl.rgb([ hue, 100, 10 ]), 0x88);
            textBox.entity.sendNetworkUpdate();
        }
    }

    @Subscribe(PluginEvents.PLACE_BLOCK)
    public onPlaceBlock(event: PlaceBlockEvent) {
        const floatingText = event.serverPlayer.world.spawnEntity(TextEntity);
        floatingText.text = "Placed by " + event.peer.username;
        floatingText.position.set(event.x + 0.5, event.y + 1.25, event.z + 0.5);
        floatingText.sendNetworkUpdate();
        floatingText.sendMovementUpdate();

        const entry = {
            entity: floatingText,
            birth: this.server.time
        }
        this.textBoxes.add(entry);
    }
}