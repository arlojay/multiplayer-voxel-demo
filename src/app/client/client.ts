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
    public time: number;
    public gameUIControl: GameUIControl;
    public debugInfo: DebugInfo;
    
    constructor(gameUIControl: GameUIControl) {
        super();
        Client.instance = this;
        this.gameUIControl = gameUIControl;

        this.gameRenderer = new GameRenderer(gameUIControl);
        this.playerController = new PlayerController(gameUIControl.getCanvas());
        
        this.gameRenderer.addListener("frame", (time, dt) => {
            this.update(time, dt);
            this.debugInfo.update(time);
        });

        let lastForcedUpdate = 0;
        let lastRealUpdate = 0;
        let firstForcedUpdate = 0;

        setInterval(() => {
            if(this.gameUIControl.isOnTab()) {
                lastRealUpdate = this.time;
                lastForcedUpdate = firstForcedUpdate = performance.now();
                return;
            }

            const lastTime = this.time;
            this.time = (lastForcedUpdate - firstForcedUpdate) + lastRealUpdate;
            lastForcedUpdate = performance.now();

            const dt = this.time - lastTime;

            this.update(this.time, dt / 1000);
        }, 200);
    }
    
    public setDebugInfo(debugInfo: DebugInfo) {
        this.debugInfo = debugInfo;
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
                    this.gameUIControl.setLoadingHint(true, "Connecting to server");
                    const negotiationChannel = await serverSession.connect();

                    this.gameUIControl.setLoadingHint(true, "Opening negotiation channel");
                    await negotiationChannel.open();

                    this.gameUIControl.setLoadingHint(true, "Requesting server identity");
                    const serverIdentity = await negotiationChannel.request<ServerIdentity>("identity");
                    serverSession.setServerIdentity(serverIdentity.data);

                    this.gameUIControl.setLoadingHint(true, "Opening local data library");
                    dataLibrary = await this.dataLibraryManager.getLibrary(serverIdentity.data.uuid);
                    
                    await dataLibrary.open(new LibraryDataNegotiationLocator(negotiationChannel));

                    this.gameUIControl.setLoadingHint(true, "Logging in");
                    const loginRequest = await negotiationChannel.request<ClientIdentity>("login", {
                        username: connectionOptions.username,
                        color: connectionOptions.color
                    });

                    
                    this.gameUIControl.setLoadingHint(true, "Requesting content package");
                    const contentRequest = await negotiationChannel.request("content");
                    contentRequest.getStream().on("data", (stream) => {
                        this.gameUIControl.setLoadingHint(true,
                            "Downloading content package " + stream.receivedChunks + " / " + stream.totalChunks,
                            { max: stream.totalBytes, value: stream.receivedBytes }
                        );
                    });
                    const contentData = await contentRequest.getStream().waitForEnd();
                    
                    this.gameUIControl.setLoadingHint(true, "Decoding content package");
                    await this.gameUIControl.waitForRepaint();
                    const content = JSON.parse(new TextDecoder().decode(contentData)) as GameContentPackage;

                    this.gameUIControl.setLoadingHint(true, "Loading blocks into local registry");
                    await this.gameUIControl.waitForRepaint();

                    for(const block of content.blocks) {
                        const BlockClass = createDeserializedBlockClass(block);
                        serverSession.registries.blocks.register(block.id, BlockClass);
                    }
                    serverSession.registries.blocks.freeze();
                    
                    this.gameUIControl.setLoadingHint(true, "Initializing blocks");
                    await Promise.all(serverSession.registries.blocks.values().map(block => block.init(dataLibrary)));

                    this.gameUIControl.setLoadingHint(true, "Building texture atlas");
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
                    
                    this.gameUIControl.setLoadingHint(true, "Memoizing block registry");

                    await serverSession.blockDataMemoizer.memoize(textureAtlas);

                    this.gameUIControl.setLoadingHint(true, "Building block previews");
                    await serverSession.displayBlockRenderer.build(serverSession.registries.blocks);
                    UIGameBlock.setDisplayBlockRenderer(serverSession.displayBlockRenderer);
                    
                    this.gameUIControl.setLoadingHint(true, "Joining game");

                    negotiationChannel.close();
                    await serverSession.openRealtime();
                    
                    serverSession.player.username = loginRequest.data.username;
                    serverSession.player.color = loginRequest.data.color;
                    
                    this.serverSession = serverSession;
            
                    this.playerController.setPointerLocked(true);
                    serverSession.addListener("disconnected", () => {
                        this.playerController.setPointerLocked(false);
                        this.serverSession = null;
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

    public update(time: number, dt: number) {
        if(dt > 0.1) dt = 0.1;
        this.time = time;
        
        if(this.serverSession != null) {
            this.serverSession.update(time, dt);
        }
    }
}

export function getClient() {
    return Client.instance;
}