import Peer from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { GameRenderer } from "../gameRenderer";
import { createPeer } from "../turn";
import { ServerSession } from "./serverSession";
import { PlayerController } from "../playerController";
import { ControlOptions } from "../controlOptions";

interface ClientEvents {
    "login": () => void;
    "logout": () => void;
    "disconnected": () => void;

    "getchunk": (x: number, y: number, z: number, data: Uint16Array) => void;
    "setblock": (x: number, y: number, z: number, block: number) => void;
}

export class Client extends TypedEmitter<ClientEvents> {
    public static instance: Client;

    public peer: Peer;
    public online: boolean;
    public gameRenderer: GameRenderer;
    public onlineId: string;
    public serverSession: ServerSession = null;
    public playerController: PlayerController;
    public controlOptions: ControlOptions = {
        mouseSensitivity: 0.3
    };
    
    constructor(canvas: HTMLCanvasElement) {
        super();
        Client.instance = this;

        this.gameRenderer = new GameRenderer(canvas);
        this.playerController = new PlayerController(canvas, document.documentElement);
        
        this.gameRenderer.addListener("frame", (time, dt) => {
            this.update(time, dt);
        });
    }

    public login(id: string) {
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
        await this.gameRenderer.init();
    }

    public async waitForLogin() {
        if(this.online) return;
        console.log("Waiting for internet...");
        await new Promise<void>(r => this.once("login", r));
        console.log("Connected to the internet");
    }

    public async connect(id: string): Promise<ServerSession> {
        if(this.serverSession != null) throw new Error("Already connected to a server");

        console.log("Connect to " + id);
        await this.waitForLogin();
        console.log("Connecting to the server " + id);

        const serverSession = new ServerSession(this);
        await serverSession.connect(id);
        
        this.gameRenderer.setWorld(serverSession.localWorld);
        this.serverSession = serverSession;

        this.playerController.setPointerLocked(true);
        serverSession.addListener("disconnected", () => {
            this.playerController.setPointerLocked(false);
            this.serverSession = null;
        });
        serverSession.addListener("playerjoin", player => {
            this.gameRenderer.scene.add(player.mesh);
        });
        serverSession.addListener("playerleave", player => {
            this.gameRenderer.scene.remove(player.mesh);
        });

        return serverSession;
    }

    public update(time: number, dt: number) {
        if(dt > 0.1) dt = 0.1;
        
        if(this.serverSession != null) {
            this.serverSession.update(time, dt);
        }
    }
}

export function getClient() {
    return Client.instance;
}