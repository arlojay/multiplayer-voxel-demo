import Peer, { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { createPeer } from "../turn";
import { Packet, PACKET_INITIAL_SIZE, SetBlockPacket } from "../packet/packet";
import { Sink } from "ts-binary";

interface ClientEvents {
    "login": () => void;
    "logout": () => void;
    "disconnected": () => void;

    "setblock": (x: number, y: number, z: number, block: number) => void;
}

export class Client extends TypedEmitter<ClientEvents> {
    private peer: Peer;
    private serverConnection: DataConnection;
    public connected: boolean;
    
    constructor(id: string) {
        super();

        this.peer = createPeer(id);
        this.peer.addListener("open", () => {
            this.connected = true;
            this.emit("login");
        });
        this.peer.addListener("close", () => {
            this.connected = false;
            this.emit("logout");
        })
    }

    public async waitForLogin() {
        if(this.connected) return;
        console.log("Waiting for internet...");
        await new Promise<void>(r => this.once("login", r));
        console.log("Connected to the internet");
    }

    public async connect(id: string) {
        console.log("Connect to " + id);
        await this.waitForLogin();
        console.log("Connecting to the server " + id);

        const connection = this.peer.connect(id);
        this.serverConnection = connection;

        await new Promise<void>((res, rej) => {
            connection.once("open", () => {
                this.connected = true;
                res();
            });
            connection.once("error", (error) => {
                rej(new Error("Cannot connect to peer " + id, { cause: error }));
            });
            connection.once("close", () => {
                rej(new Error("Cannot connect to peer " + id));
            })
        });

        console.log("Connected to the server " + id + "!");
        this.initConnectionEvents();
    }

    private initConnectionEvents() {
        this.serverConnection.addListener("data", data => {
            if(data instanceof ArrayBuffer) {
                this.handlePacket(data);
            }
        });
        this.serverConnection.addListener("close", () => {
            this.emit("disconnected");
        })
    }
    
    public handlePacket(data: ArrayBuffer) {
        const packet = Packet.createFromBinary(data);
        
        if(packet instanceof SetBlockPacket) {
            this.emit("setblock", packet.x, packet.y, packet.z, packet.block);
        }
    }

    public sendPacket(packet: Packet) {
        const buffer = new ArrayBuffer(packet.getExpectedSize() + 2 /* Packet ID is u16 */ + 1 /* idk this just makes it work */);
        const sink = Sink(buffer);
        packet.write(sink);
        this.serverConnection.send(buffer);
    }
}