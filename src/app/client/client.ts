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
import { ClientReadyPacket } from "../packet/clientReadyPacket";
import { ClientCustomizationOptions } from "../controlOptions";

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

        await this.gameData.open();
        await this.gameData.loadAll();
        await this.gameData.saveAll();

        await this.gameRenderer.init();
    }

    public async waitForLogin() {
        if(this.online) return;
        debugLog("Waiting for internet...");
        await new Promise<void>(r => this.once("login", r));
        debugLog("Connected to the internet");
    }

    public async initServerConnection(id: string, connectionOptions: ClientCustomizationOptions): Promise<ConnectionRequestController> {
        if(this.serverSession != null) throw new Error("Already connected to a server");

        await this.waitForLogin();
        debugLog("Connecting to the server " + id);

        const serverSession = new ServerSession(this);

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
                    await serverSession.connect(id);
                    
                    this.serverSession = serverSession;
            
                    this.playerController.setPointerLocked(true);
                    serverSession.addListener("disconnected", () => {
                        this.playerController.setPointerLocked(false);
                        this.serverSession = null;
                    });
                    serverSession.addListener("changeworld", world => {
                        this.gameRenderer.setWorld(world);
                    });
            
                    this.gameRenderer.setWorld(serverSession.localWorld);
                
                    const readyPacket = new ClientReadyPacket();
                    readyPacket.username = connectionOptions.username;
                    readyPacket.color = connectionOptions.color;
                    serverSession.sendPacket(readyPacket);

                    serverSession.removeListener("disconnected", disconnectedCallback);
            
                    res(serverSession);
                } catch(e) {
                    if(!controller.failed) {
                        controller.failed = true;
                        if(controller.onerror == null) {
                            throw e;
                        } else {
                            controller.onerror(e);
                        }
                    }
                }
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