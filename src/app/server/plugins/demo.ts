import hsl from "color-space/hsl";
import { Block } from "../../block/block";
import { BlockModel, BlockModelCuboid } from "../../block/blockModel";
import { DataLibrary } from "../../datalibrary/dataLibrary";
import { BASIC_COLLIDER } from "../../entity/collisionChecker";
import { TextEntity } from "../../entity/impl";
import { BaseRegistries } from "../../synchronization/baseRegistries";
import { UIButton, UISection, UIText } from "../../ui";
import { DatabaseObjectStore, DatabaseView } from "../databaseView";
import { Subscribe } from "../events";
import { PeerJoinEvent, PlaceBlockEvent, PluginEvents, ServerLoadedEvent, ServerTickEvent } from "../pluginEvents";
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
    private textBoxes: Set<TextEntity> = new Set;

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
        const session = event.peer.createUISession(ui);

        const updateClicks = () => {
            text.setText(entry.data.clicks + " clicks");
        }

        const button = new UIButton("Add click");
        ui.addChild(button);
        button.onClick(() => {
            entry.data.clicks++;
            entry.save();
            
            updateClicks();
        });
        
        updateClicks();

        const kickButton = new UIButton("kick");
        kickButton.onClick(() => {
            event.peer.kick("Self-kick");
        });
        ui.addChild(kickButton);
        
        session.open();
    }

    public async addContent(registries: BaseRegistries, dataLibrary: DataLibrary) {
        registries.blocks.register("jerma", class extends Block {
            public async init(dataLibrary: DataLibrary) {
                this.addState(
                    "default",
                    new BlockModel(
                        new BlockModelCuboid()
                        .createAllFaces()
                        .setAllTextures(await dataLibrary.getAsset("textures/player-face.png").then(t => t.loadTexture()))
                    ),
                    BASIC_COLLIDER.collider
                )
            }
        })
    }

    @Subscribe(PluginEvents.SERVER_TICK)
    public onTick(event: ServerTickEvent) {
        for(const textBox of this.textBoxes) {
            if(textBox.lifeTime > 5) {
                textBox.remove();
                this.textBoxes.delete(textBox);
                continue;
            }

            const hue = textBox.lifeTime / 5 * 360;

            textBox.color.set(...hsl.rgb([ hue, 100, 70 ]), 0xff);
            textBox.background.set(...hsl.rgb([ hue, 100, 10 ]), 0x88);
            textBox.sendNetworkUpdate();
        }
    }

    @Subscribe(PluginEvents.PLACE_BLOCK)
    public onPlaceBlock(event: PlaceBlockEvent) {
        const floatingText = event.serverPlayer.world.spawnEntity(TextEntity);
        floatingText.text = "Placed by " + event.peer.username;
        floatingText.position.set(event.x + 0.5, event.y + 1.25, event.z + 0.5);

        this.textBoxes.add(floatingText);
    }
}