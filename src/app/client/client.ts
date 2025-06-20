import Peer from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { GameRenderer } from "../gameRenderer";
import { createPeer } from "../turn";
import { ServerSession } from "./serverSession";
import { PlayerController } from "../playerController";
import { debugLog } from "../logging";
import { GameData } from "../gameData";
import { AudioManager } from "../sound/soundManager";
import { ClientSounds } from "./clientSounds";
import { ClientCustomizationOptions } from "../controlOptions";
import { DataLibrary, DataLibraryManager } from "../data/dataLibrary";
import { GameContentPackage } from "../network/gameContentPackage";
import { createDeserializedBlockClass } from "../block/block";
import { TextureAtlas } from "../texture/textureAtlas";
import { NearestFilter } from "three";
import { terrainMap } from "../shaders/terrain";
import { addCustomVoxelMesh, resetCustomVoxelMeshes } from "../voxelMesher";
import { addCustomVoxelCollider, resetCustomVoxelColliders } from "../entity/collisionChecker";
import { compileBlockModel } from "../block/blockModel";
import { LibraryDataNegotiationLocator } from "../data/libraryDataNegotiationLocator";
import { ClientIdentity, ServerIdentity } from "../serverIdentity";

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
    
    constructor(gameRoot: HTMLElement) {
        super();
        Client.instance = this;

        const canvas = gameRoot.querySelector("canvas") as HTMLCanvasElement;
        const UIRoot = gameRoot.querySelector("#game-ui") as HTMLDivElement;
        this.gameRenderer = new GameRenderer(canvas, UIRoot);
        this.playerController = new PlayerController(canvas);
        
        this.gameRenderer.addListener("frame", (time, dt) => {
            this.update(time, dt);
        });

        let lastForcedUpdate = 0;
        let lastRealUpdate = 0;
        let firstForcedUpdate = 0;

        setInterval(() => {
            if(document.visibilityState == "visible") {
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
        debugLog("Waiting for internet...");
        await new Promise<void>(r => this.once("login", r));
        debugLog("Connected to the internet");
    }

    public async initServerConnection(serverPeerId: string, connectionOptions: ClientCustomizationOptions): Promise<ConnectionRequestController> {
        if(this.serverSession != null) throw new Error("Already connected to a server");

        await this.waitForLogin();
        debugLog("Connecting to the server " + serverPeerId);

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
                    const negotiationChannel = await serverSession.connect();
                    await negotiationChannel.open();

                    const serverIdentity = await negotiationChannel.request<ServerIdentity>("identity");
                    serverSession.setServerIdentity(serverIdentity.data);
                    
                    console.log("<client> hello " + serverIdentity.data.uuid + "!! gonna try and get blocks now...");

                    dataLibrary = await this.dataLibraryManager.getLibrary(serverIdentity.data.uuid);
                    console.log("opening data library", dataLibrary);
                    await dataLibrary.open(new LibraryDataNegotiationLocator(negotiationChannel));

                    const loginRequest = await negotiationChannel.request<ClientIdentity>("login", {
                        username: connectionOptions.username,
                        color: connectionOptions.color
                    });

                    console.log("<client> gonna try and get blocks now...");
                    const content = await negotiationChannel.request<GameContentPackage>("content");

                    resetCustomVoxelColliders();
                    resetCustomVoxelMeshes();

                    for(const block of content.data.blocks) {
                        const BlockClass = createDeserializedBlockClass(block);
                        serverSession.registries.blocks.register(block.id, BlockClass);
                    }
                    serverSession.registries.blocks.freeze();
                    
                    await Promise.all(serverSession.registries.blocks.values().map(block => block.init(dataLibrary)));

                    const textureAtlas = new TextureAtlas;
                    for(const block of serverSession.registries.blocks.values()) {
                        console.log(block);
                        for(const textureAsset of block.model.getUsedTextures()) {
                            textureAtlas.addTexture(textureAsset.getTexture());
                        }
                    }
                    textureAtlas.build();
                    textureAtlas.builtTexture.magFilter = NearestFilter;
                    textureAtlas.builtTexture.colorSpace = "srgb";
                    terrainMap.value = textureAtlas.builtTexture;
                    
                    for await(const block of serverSession.registries.blocks.values()) {
                        addCustomVoxelMesh(await compileBlockModel(block.model, textureAtlas));
                        addCustomVoxelCollider(block.collider);
                        console.log(block.collider);
                    }

                    console.log(content.data.blocks);
                    console.log("<client> woohoo!!! joining now!!");

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