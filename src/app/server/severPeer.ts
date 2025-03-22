import { TypedEmitter } from "tiny-typed-emitter";
import { GetChunkPacket, Packet, PACKET_INITIAL_SIZE } from "../packet/packet";
import { Server } from "./server";
import { ServerClient } from "./serverClient";
import { Sink } from "ts-binary";
import { MessagePortConnection } from "./thread";

interface ServerPeerEvents {
    "getchunk": (packet: GetChunkPacket) => void;
}

export class ServerPeer extends TypedEmitter<ServerPeerEvents> {
    public connection: MessagePortConnection;
    public connected: boolean = false;
    public id: string;
    public server: Server;
    public client: ServerClient;


    constructor(connection: MessagePortConnection, server: Server) {
        super();
        this.connection = connection;
        this.id = connection.peer;
        this.server = server;

        this.client = new ServerClient;

        connection.addListener("open", () => {
            this.connected = true;
        });
        connection.addListener("close", () => {
            this.connected = false;
        });
        connection.addListener("error", () => {
            this.connected = false;
        });
    }

    private connectionPromise: Promise<void>;
    public waitForConnection() {
        if(this.connected) return;
        
        return this.connectionPromise ??= new Promise<void>((res, rej) => {
            this.connection.once("open", () => {
                res();
            });
            this.connection.once("error", e => {
                rej(e);
            });
            this.connection.once("close", () => {
                rej();
            });
        }).then(() => {
            this.connectionPromise = null;
        });
    }

    public handlePacket(data: ArrayBuffer) {
        const packet = Packet.createFromBinary(data);

        if(packet instanceof GetChunkPacket) {
            this.emit("getchunk", packet);
        }
    }

    public async sendPacket(packet: Packet) {
        const buffer = new ArrayBuffer(packet.getExpectedSize() + 2 /* Packet ID is u16 */ + 1 /* idk this just makes it work */);
        const sink = Sink(buffer);
        packet.write(sink);
        await this.waitForConnection();
        this.connection.send(buffer);
    }
}