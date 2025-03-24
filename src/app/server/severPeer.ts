import { TypedEmitter } from "tiny-typed-emitter";
import { Sink } from "ts-binary";
import { CombinedPacket, GetChunkPacket, Packet } from "../packet/packet";
import { Server } from "./server";
import { ServerClient } from "./serverClient";
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
    private packetQueue: Set<ArrayBuffer> = new Set;


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

    public sendPacket(packet: Packet, instant: boolean = false) {
        const buffer = new ArrayBuffer(packet.getExpectedSize() + 2 /* Packet ID is u16 */ + 1 /* idk this just makes it work */);
        packet.write(Sink(buffer));

        
        if(packet instanceof CombinedPacket) {
            console.log(new Uint8Array(buffer));
        }

        if(instant) {
            if(this.connected) {
                this.connection.send(buffer);
            } else {
                this.waitForConnection().then(() => {
                    this.connection.send(buffer);
                });
            }
        } else {
            this.packetQueue.add(buffer);
        }
    }

    public flushPacketQueue() {
        let fullLength = 0;
        for(const packet of this.packetQueue) fullLength += packet.byteLength;

        if(fullLength == 0) return;

        // No benefit from sending a singular packet, bundled
        if(fullLength == 1) {
            console.log("Send single queued packet");
            for(const packet of this.packetQueue) this.connection.send(packet);
            return;
        }

        console.log("Send multiple queued packets (" + this.packetQueue.size + ")");

        const combinedPacket = new CombinedPacket;
        for(const packet of this.packetQueue) combinedPacket.packets.add(packet);

        this.packetQueue.clear();
        if(this.connected) {
            this.sendPacket(combinedPacket, true);
        } else {
            this.waitForConnection().then(() => {
                this.sendPacket(combinedPacket, true);
            });
        }
    }
}