import { World } from "../../../world";
import { UIButton, UIForm, UISection, UIText } from "../../../ui";
import { WorldGenerator } from "../../../worldGenerator";
import { Subscribe } from "../../events";
import { PeerJoinEvent, PeerLeaveEvent, PluginEvents, ServerLoadedEvent } from "../../pluginEvents";
import { ServerPeer } from "../../serverPeer";
import { ServerPlugin } from "../../serverPlugin";
import { ChatUIManager } from "./chatUIManager";
import { CHUNK_INC_SCL, CHUNK_SIZE, VoxelGridChunk } from "../../../voxelGrid";
import { SimplexNoiseGenerator } from "../../../noise/impl/generator/simplexNoiseGenerator";
import { NoiseNode } from "../../../noise/noiseNode";
import { NoiseScaler } from "../../../noise/impl/transformer/noiseScaler";
import { NoiseOperation, OperationType } from "../../../noise/impl/transformer/noiseOperation";
import { ConstantValueGenerator } from "../../../noise/impl/generator/constantValueGenerator";
import { OctaveNoise } from "../../../noise/impl/transformer/octaveNoise";

class SimplexTerrainGenerator extends WorldGenerator {
    private noise: NoiseNode;

    constructor(world: World) {
        super(world);

        this.noise = new NoiseScaler(
            new NoiseOperation(
                new OctaveNoise(
                    new SimplexNoiseGenerator(0, 0),
                    8, 0.5, 2, 0.3
                ),
                new ConstantValueGenerator(60),
                OperationType.MULTIPLY
            ),
            100, 100, 100, 100
        );
    }
    public generateChunk(x: number, y: number, z: number): VoxelGridChunk {
        const world = this.world;

        const chunk = world.blocks.getChunk(x, y, z);
        let globalX = x << CHUNK_INC_SCL;
        let globalY = y << CHUNK_INC_SCL;
        let globalZ = z << CHUNK_INC_SCL;

        for(let x = 0; x < CHUNK_SIZE; x++, globalX++) {
            for(let z = 0; z < CHUNK_SIZE; z++, globalZ++) {
                const height = this.noise.sample2d(globalX, globalZ);
                for(let y = 0; y < CHUNK_SIZE; y++, globalY++) {
                    let color = 0x000000;

                    if(globalY < height - 5) color = 0x888888;
                    else if(globalY < height - 1) color = 0xCC9966;
                    else if(globalY < height) color = 0xBBFF99;

                    if(color != 0x000000) chunk.set(x, y, z, world.getValueFromColor(color));
                }
                globalY -= CHUNK_SIZE;
            }
            globalZ -= CHUNK_SIZE;
        }

        return chunk;
    }
}

export class Freebuild extends ServerPlugin {
    private world: World;
    private privateWorlds: Map<ServerPeer, World> = new Map;
    private chatUIManager: ChatUIManager = new ChatUIManager;

    @Subscribe(PluginEvents.SERVER_LOADED)
    public async onLoad(event: ServerLoadedEvent) {
        const world = event.server.getDefaultWorld();
        world.setGenerator(new WorldGenerator(world));
        this.world = world;
    }

    @Subscribe(PluginEvents.PEER_JOIN)
    public onPeerJoin(event: PeerJoinEvent) {
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

        this.chatUIManager.onPeerJoin(event.peer);
    }
    
    @Subscribe(PluginEvents.PEER_LEAVE)
    public onPeerLeave(event: PeerLeaveEvent) {
        this.chatUIManager.onPeerLeave(event.peer);
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