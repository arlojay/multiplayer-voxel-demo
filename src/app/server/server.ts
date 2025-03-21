import Peer, { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { ServerPeer } from "./severPeer";
import { createPeer } from "../turn";
import { Packet } from "../packet/packet";
import { World } from "../world";

interface ServerEvents {
    "connection": (peer: ServerPeer) => void;
}

export class Server extends TypedEmitter<ServerEvents> {
    public id: string;
    public peer: Peer;
    public worlds: Map<string, World> = new Map;
    public connections: Map<string, ServerPeer> = new Map;

    constructor(id: string) {
        super();
        this.id = id;
    }

    public async start() {
        this.peer = createPeer(this.id);

        console.log("Starting server " + this.id + "...");
        await new Promise<void>((res, rej) => {
            this.peer.once("open", () => res());
        });
        console.log("Server connected to internet");

        this.initListeners();

        this.worlds.set("world", new World());
        this.startLoop();

        console.log("Server loaded!");
    }

    private startLoop() {
        const mainWorld = this.worlds.get("world");
        setInterval(() => {
            // mainWorld.setColor()
        }, 1000 / 20);
    }


    private initListeners() {
        this.peer.addListener("connection", connection => {
            this.handleConnection(connection);
        });
    }

    private async handleConnection(connection: DataConnection) {
        const peer = new ServerPeer(connection, this);
        peer.client.setWorld(this.worlds.get("world"));
        
        this.connections.set(peer.id, peer);

        await new Promise<void>((res, rej) => {
            connection.once("open", () => res());
            connection.once("error", e => {
                this.handleDisconnection(peer, e);
                rej(e);
            });
        })

        connection.addListener("data", data => {
            if(data instanceof ArrayBuffer) {
                peer.handlePacket(Packet.createFromBinary(data));
            }
        });

        this.emit("connection", peer);
    }

    private handleDisconnection(peer: ServerPeer, cause: { toString(): string }) {
        console.log("Peer " + peer.id + " disconnected: " + cause.toString());
    }
}