import { UISection, UIStorageInterface } from "../../ui";
import { Inventory } from "../../storage/inventory";
import { Subscribe } from "../events";
import { InteractBlockEvent, PluginEvents } from "../pluginEvents";
import { ServerPlugin } from "../serverPlugin";
import { StorageLayout } from "../../storage/storageLayout";
import { Block } from "../../block/block";
import { DataLibrary } from "../../datalibrary/dataLibrary";
import { BaseRegistries } from "../../synchronization/baseRegistries";
import { BlockModel, BlockModelCuboid } from "../../block/blockModel";
import { BASIC_COLLIDER } from "../../entity/collisionChecker";
import { BlockStateType } from "../../block/blockStateType";

export class InventoryPlugin extends ServerPlugin {
    public readonly name = "inventory";

    private inventories: Map<string, Inventory> = new Map;
    private storageLayout: StorageLayout;

    @Subscribe(PluginEvents.SERVER_PREINIT)
    public onServerPreinit() {
        this.storageLayout = this.server.createStorageLayout();

        const width = 4;
        const height = 4;

        for(let x = 0, i = 0; x < width; x++) {
            for(let y = 0; y < height; y++, i++) {
                this.storageLayout.setSlotPosition(i, x, y);
            }
        }
    }

    @Subscribe(PluginEvents.INTERACT_BLOCK)
    public onInteractBlock(event: InteractBlockEvent) {
        if(event.block.getSaveKey() == "storage#default") {
            const positionKey = event.x + ";" + event.y + ";" + event.z;
            let inventory = this.inventories.get(positionKey);

            if(inventory == null) {
                inventory = this.server.createInventory();
                
                this.inventories.set(positionKey, inventory);

                inventory.setSize(16);

                const allStates = this.server.registries.blocks.values().flatMap(block => block.states.values()).toArray();
                const excludeBlocks = ["color", "air"];
                for(const slot of inventory.slots) {
                    if(Math.random() > 0.5) continue;
                    let state: BlockStateType;
                    do {
                        state = allStates[Math.floor(Math.random() * allStates.length)];
                    } while(excludeBlocks.includes(state.saveKeyPair[0]));
                    slot.set(
                        state,
                        Math.ceil(Math.random() * 64)
                    );
                }
            }


            event.peer.updateInventory(inventory);
            event.peer.updateStorageLayout(this.storageLayout);

            const root = new UISection;
            root.style.display = "grid";
            root.style.gridTemplateRows = "max-content max-content";
            root.style.justifyItems = "center";
            root.addChild(new UIStorageInterface("Storage", inventory, this.storageLayout, event.player.movingSlot));
            root.addChild(new UIStorageInterface("Inventory", event.player.inventory, event.player.inventoryLayout, event.player.movingSlot));

            const session = event.peer.createUISession(root);
            session.blocking = true;
            session.spotlight = true;
            session.closable = true;
            session.open();
        }
    }

    public async addContent(registries: BaseRegistries, dataLibrary: DataLibrary) {
        registries.blocks.register("storage",
            class StorageBlock extends Block {
                public async init(dataLibrary: DataLibrary) {
                    const sideTexture = await dataLibrary.getAsset("textures/storage-side.png").then(v => v.loadTexture());
                    const bottomTexture = await dataLibrary.getAsset("textures/storage-bottom.png").then(v => v.loadTexture());
                    const topTexture = await dataLibrary.getAsset("textures/storage-top.png").then(v => v.loadTexture());

                    this.addState("default",
                        new BlockModel(
                            new BlockModelCuboid()
                            .createAllFaces()
                            .setAllTextures(sideTexture)
                            .setUpTexture(topTexture)
                            .setDownTexture(bottomTexture)
                        ),
                        BASIC_COLLIDER.collider
                    )
                }
            }
        );
    }
}