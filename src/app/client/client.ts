import Peer from "peerjs";
import { NearestFilter } from "three";
import { TypedEmitter } from "tiny-typed-emitter";
import { createDeserializedBlockClass } from "../block/block";
import { ClientCustomizationOptions } from "../controls/controlOptions";
import { PlayerController } from "../controls/playerController";
import { DataLibrary, DataLibraryManager } from "../datalibrary/dataLibrary";
import { LibraryDataNegotiationLocator } from "../datalibrary/libraryDataNegotiationLocator";
import { DebugInfo, GameUIControl } from "../game";
import { GameContentPackage } from "../network/gameContentPackage";
import { setTextureAtlas as setTerrainTextureAtlas } from "../shaders/terrain";
import { AudioManager } from "../sound/soundManager";
import { ClientIdentity, ServerIdentity } from "../synchronization/serverIdentity";
import { TextureAtlas } from "../texture/textureAtlas";
import { createPeer } from "../turn";
import { UIGameBlock } from "../ui/UIGameBlock";
import { ClientSounds } from "./clientSounds";
import { GameData } from "./gameData";
import { GameRenderer } from "./gameRenderer";
import { ServerSession } from "./serverSession";
import { TimeMetric } from "./updateMetric";

interface ClientEvents {
    "login": () => void;
    "logout": () => void;
    "disconnected": () => void;

    "getchunk": (x: number, y: number, z: number, data: Uint16Array) => void;
    "setblock": (x: number, y: number, z: number, block: number) => void;
}

interface ConnectionRequestController {
    promise: Promise<ServerSession>;
    prematureServerSession: ServerSession;
    onerror?: (error: Error) => void;
    failed: boolean;
}

export class Client extends TypedEmitter<ClientEvents> {
    public static instance: Client;

    public peer: Peer;
    public online: boolean;
    public gameRenderer: GameRenderer;
    public onlineId: string;
    public serverSession: ServerSession = null;
    public playerController: PlayerController;
    public gameData = new GameData;
    public audioManager = new AudioManager;
    public dataLibraryManager = new DataLibraryManager("client");
    public lastMetric: TimeMetric = {
        time: 0,
        timeMs: 0,
        dt: 0,
        dtMs: 0,
        budget: { msLeft: 0 }
    };
    public gameUIControl: GameUIControl;
    public debugInfo: DebugInfo;
    public serverConnectionExists = false;
    
    constructor(gameUIControl: GameUIControl) {
        super();
        Client.instance = this;
        this.gameUIControl = gameUIControl;

        this.gameRenderer = new GameRenderer(gameUIControl);
        this.playerController = new PlayerController(gameUIControl.getCanvas());
        
        this.gameRenderer.addListener("update", (metric) => {
            this.update(metric);
            this.debugInfo.update(metric);
        });

        let lastForcedUpdate = 0;
        let lastRealUpdate = 0;
        let firstForcedUpdate = 0;

        setInterval(() => {
            if(this.gameUIControl.isOnTab()) {
                lastRealUpdate = this.lastMetric.timeMs;
                lastForcedUpdate = firstForcedUpdate = performance.now();
                return;
            }

            const lastTime = this.lastMetric.timeMs;
            const time = (lastForcedUpdate - firstForcedUpdate) + lastRealUpdate;
            lastForcedUpdate = performance.now();

            const dt = time - lastTime;

            this.update({
                time: time / 1000,
                timeMs: time,
                dt: dt / 1000,
                dtMs: dt,
                budget: {
                    msLeft: 10
                }
            });
        }, 200);
    }
    
    public setDebugInfo(debugInfo: DebugInfo) {
        this.debugInfo = debugInfo;
    }

    public async screenshot(name = new Date().toISOString()) {
        const snapshot = await this.gameRenderer.exportSnapshot();
        const screenshotLibrary = await this.dataLibraryManager.getLibrary("screenshots");
        await screenshotLibrary.open(null);
        const asset = await screenshotLibrary.createAsset(name, snapshot);
        screenshotLibrary.close();
        return asset;
    }

    public login(id: string = "client-" + Math.random().toString().slice(2) + "-mvd") {
        this.onlineId = id;

        this.peer = createPeer(id);
        
        this.peer.addListener("open", () => {
            this.online = true;
            this.emit("login");
        });
        this.peer.addListener("close", () => {
            this.online = false;
            this.emit("logout");
        })

        return new Promise<void>((res, rej) => {
            this.peer.once("open", () => res());
            this.peer.once("error", (e) => rej(new Error("Client cannot login with id " + id, { cause: e })));
            this.peer.once("close", () => rej(new Error("Client cannot login with id " + id)));
        });
    }

    public async init() {
        await this.audioManager.init();
        ClientSounds.init(this.audioManager);

        await this.dataLibraryManager.open();

        console.log("Opening game data");
        await this.gameData.open();
        await this.gameData.loadAll();
        await this.gameData.saveAll();

        console.log("Initializing renderer");
        await this.gameRenderer.init();
    }

    public async waitForLogin() {
        if(this.online) return;
        console.log("Waiting for internet...");
        await new Promise<void>(r => this.once("login", r));
        console.log("Connected to the internet");
    }

    public async initServerConnection(serverPeerId: string, connectionOptions: ClientCustomizationOptions): Promise<ConnectionRequestController> {
        if(this.serverSession != null) throw new Error("Already connected to a server");
        
        await this.waitForLogin();
        console.log("Connecting to the server " + serverPeerId);
        
        const serverSession = new ServerSession(this, serverPeerId);
        let dataLibrary: DataLibrary;

        const controller: ConnectionRequestController = {
            failed: false,
            prematureServerSession: serverSession,
            promise: new Promise(async (res, rej) => {
                await new Promise(r => setTimeout(r, 0));

                const disconnectedCallback = (reason: string) => {
                    if(!controller.failed) {
                        controller.failed = true;
                        const error = new Error(reason);
                        if(controller.onerror == null) {
                            throw error;
                        } else {
                            controller.onerror(error);
                        }
                    }
                }
                serverSession.addListener("disconnected", disconnectedCallback);

                try {
                    this.gameUIControl.loadingScreen.setHint("Connecting to server");
                    this.gameUIControl.loadingScreen.setProgress({});
                    const negotiationChannel = await serverSession.connect();
                    this.serverConnectionExists = true;
                    
                    this.gameUIControl.loadingScreen.setCancellable(false);

                    this.gameUIControl.loadingScreen.setHint("Opening negotiation channel");
                    await negotiationChannel.open();
                    
                    this.gameUIControl.loadingScreen.clearProgress();

                    this.gameUIControl.loadingScreen.setHint("Requesting server identity");
                    const serverIdentity = await negotiationChannel.request<ServerIdentity>("identity");
                    serverSession.setServerIdentity(serverIdentity.data);

                    this.gameUIControl.loadingScreen.setHint("Opening local data library");
                    dataLibrary = await this.dataLibraryManager.getLibrary(serverIdentity.data.uuid);
                    
                    await dataLibrary.open(new LibraryDataNegotiationLocator(negotiationChannel));

                    this.gameUIControl.loadingScreen.setHint("Logging in");
                    const loginRequest = await negotiationChannel.request<ClientIdentity>("login", {
                        username: connectionOptions.username,
                        color: connectionOptions.color
                    });

                    
                    this.gameUIControl.loadingScreen.setTitle("Loading content package");
                    this.gameUIControl.loadingScreen.setHint("Downloading content package");
                    const contentRequest = await negotiationChannel.request("content");

                    contentRequest.getStream().on("data", (stream) => {
                        this.gameUIControl.loadingScreen.setHint(
                            "Downloading content package " + stream.receivedChunks + " / " + stream.totalChunks
                        );
                        this.gameUIControl.loadingScreen.setProgress(
                            { max: stream.totalBytes, value: stream.receivedBytes }
                        );
                    });
                    const contentData = await contentRequest.getStream().waitForEnd();
                    this.gameUIControl.loadingScreen.clearProgress();
                    
                    this.gameUIControl.loadingScreen.setHint("Decoding content package");
                    await this.gameUIControl.waitForRepaint();
                    const content = JSON.parse(new TextDecoder().decode(contentData)) as GameContentPackage;


                    this.gameUIControl.loadingScreen.setTitle("Initializing blocks");
                    this.gameUIControl.loadingScreen.setHint("Loading blocks into local registry");
                    await this.gameUIControl.waitForRepaint();

                    for(const block of content.blocks) {
                        const BlockClass = createDeserializedBlockClass(block);
                        serverSession.registries.blocks.register(block.id, BlockClass);
                    }
                    serverSession.registries.blocks.freeze();
                    
                    let loadedBlocks = 0;
                    const totalBlockToLoad = serverSession.registries.blocks.size();
                    for await(const block of serverSession.registries.blocks.values()) {
                        this.gameUIControl.loadingScreen.setHint("Loading " + block.id);
                        this.gameUIControl.loadingScreen.setProgress({
                            max: totalBlockToLoad,
                            value: ++loadedBlocks
                        })
                        await block.init(dataLibrary);
                    }
                    this.gameUIControl.loadingScreen.clearProgress();

                    this.gameUIControl.loadingScreen.setTitle("Building local assets");
                    this.gameUIControl.loadingScreen.setHint("Building texture atlas");
                    await this.gameUIControl.waitForRepaint();

                    const textureAtlas = new TextureAtlas;
                    for(const block of serverSession.registries.blocks.values()) {
                        for(const state of block.states.values()) {
                            for(const textureAsset of state.model.getUsedTextures()) {
                                textureAtlas.addTexture(textureAsset.getTexture());
                            }
                        }
                    }
                    textureAtlas.build();
                    textureAtlas.builtTexture.magFilter = NearestFilter;
                    textureAtlas.builtTexture.colorSpace = "srgb";
                    textureAtlas.builtTexture.generateMipmaps = false;
                    await setTerrainTextureAtlas(textureAtlas);
                    
                    this.gameUIControl.loadingScreen.setHint("Memoizing block registry");

                    await serverSession.blockDataMemoizer.memoize(textureAtlas);

                    this.gameUIControl.loadingScreen.setHint("Building block previews");
                    await serverSession.displayBlockRenderer.build(serverSession.registries.blocks, (finished, total) => {
                        this.gameUIControl.loadingScreen.setProgress({ max: total, value: finished });
                    });
                    this.gameUIControl.loadingScreen.clearProgress();
                    UIGameBlock.setDisplayBlockRenderer(serverSession.displayBlockRenderer);
                    
                    this.gameUIControl.loadingScreen.setHint("Compiling shaders");
                    await Client.instance.gameRenderer.compileMaterials();
                    
                    this.gameUIControl.loadingScreen.setTitle("Joining game");
                    this.gameUIControl.loadingScreen.clearHint();

                    negotiationChannel.close();
                    await serverSession.openRealtime();
                    
                    serverSession.player.username = loginRequest.data.username;
                    serverSession.player.color = loginRequest.data.color;
                    
                    this.serverSession = serverSession;
            
                    this.playerController.setPointerLocked(true);
                    serverSession.addListener("disconnected", () => {
                        this.playerController.setPointerLocked(false);
                        this.serverSession = null;
                        this.serverConnectionExists = true;
                        dataLibrary?.close();
                    });
                    serverSession.addListener("changeworld", world => {
                        this.gameRenderer.setWorld(world);
                    });
            
                    this.gameRenderer.setWorld(serverSession.localWorld);

                    res(serverSession);

                } catch(e) {
                    dataLibrary?.close();

                    if(!controller.failed) {
                        controller.failed = true;
                        if(controller.onerror == null) {
                            throw e;
                        } else {
                            controller.onerror(e);
                        }
                    }
                }

                serverSession.removeListener("disconnected", disconnectedCallback);
            })
        }
        return controller;
    }

    public update(metric: TimeMetric) {
        this.lastMetric = metric;
        
        if(this.serverSession != null) {
            this.serverSession.update(metric);
        }

        this.gameRenderer.maxFps = this.gameData.clientOptions.maxFPS;
        this.gameRenderer.maxUps = this.gameData.clientOptions.maxFPS;

        this.gameRenderer.budgetTime = this.gameData.clientOptions.budgetUpdateTime;
    }
}

export function getClient() {
    return Client.instance;
}