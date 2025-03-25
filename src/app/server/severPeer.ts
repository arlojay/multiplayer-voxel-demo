import { TypedEmitter } from "tiny-typed-emitter";
import { CombinedPacket, GetChunkPacket, Packet } from "../packet/packet";
import { Server } from "./server";
import { ServerClient } from "./serverClient";
import { MessagePortConnection } from "./thread";
import { BinaryWriter, U16 } from "../binary";

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
        const buffer = new ArrayBuffer(packet.getExpectedSize() + U16);
        packet.write(new BinaryWriter(buffer));

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
        if(this.packetQueue.size == 0) return;

        const maxAggregateBytes = 0x4000;

        
        while(this.packetQueue.size > 0) {
            const combinedPacket = new CombinedPacket;
            const iterator = this.packetQueue.values();

            let next: IteratorResult<ArrayBuffer, ArrayBuffer> = iterator.next();
            let byteAggregate = 0;
            while(!next.done) {
                if(byteAggregate + next.value.byteLength > maxAggregateBytes) break;

                byteAggregate += next.value.byteLength;
                
                combinedPacket.packets.add(next.value);
                this.packetQueue.delete(next.value);

                next = iterator.next();
            }

            // No benefit from bundling a singular packet
            if(combinedPacket.packets.size == 1) {
                for(const packet of combinedPacket.packets) this.connection.send(packet);
                continue;
            }

            console.log("Send " + combinedPacket.packets.size + " combined packets (" + byteAggregate + " Bytes)");
            if(this.connected) {
                this.sendPacket(combinedPacket, true);
            } else {
                this.waitForConnection().then(() => {
                    this.sendPacket(combinedPacket, true);
                });
            }
        }
    }
}