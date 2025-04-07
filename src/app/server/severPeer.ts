import { TypedEmitter } from "tiny-typed-emitter";
import { BreakBlockPacket, ClientMovePacket, CombinedPacket, GetChunkPacket, KickPacket, Packet, PingPacket, PingResponsePacket, PlaceBlockPacket } from "../packet/packet";
import { Server } from "./server";
import { ServerClient } from "./serverClient";
import { MessagePortConnection } from "./thread";
import { BinaryWriter, U16 } from "../binary";
import { RemotePlayer } from "../client/remotePlayer";
import { ServerPlayer } from "./serverPlayer";
import { debugLog } from "../logging";

interface ServerPeerEvents {
    "chunkrequest": (packet: GetChunkPacket) => void;
    "move": () => void;
    "disconnected": (cause: string) => void;
}

export class TimedOutError extends Error {

}

export class ServerPeer extends TypedEmitter<ServerPeerEvents> {
    public connection: MessagePortConnection;
    public connected: boolean = false;
    public id: string;
    public server: Server;
    public client: ServerClient;
    public player: ServerPlayer = null;
    private packetQueue: Set<ArrayBuffer> = new Set;
    private pingPromise: Promise<number> = null;
    public ping: number = 0;
    private onPingResponse: () => void = null;
    private lastPacketReceived: Map<number, number> = new Map;


    constructor(connection: MessagePortConnection, server: Server) {
        super();
        this.connection = connection;
        this.id = connection.peer;
        this.server = server;

        this.client = new ServerClient;
        this.player = new ServerPlayer;

        connection.addListener("open", () => {
            this.connected = true;
            this.initPingLoop();
        });
        connection.addListener("close", () => {
            if(!this.connected) return;

            this.connected = false;
            this.emit("disconnected", "Connection lost");
        });
        connection.addListener("error", () => {
            this.connected = false;
        });
    }
    private async initPingLoop() {
        try {
            while(this.connected) {
                await this.sendPing();
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch(e) {
            if(e instanceof TimedOutError) {
                console.log(e);
                this.kick("Timed out");
            } else {
                this.kick("Internal server error");
                throw e;
            }
        }
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

    private isPacketOld(packet: Packet) {
        return this.lastPacketReceived.get(packet.id) > packet.timestamp;
    }

    public handlePacket(data: ArrayBuffer) {
        const packet = Packet.createFromBinary(data);

        if(packet instanceof GetChunkPacket) {
            this.emit("chunkrequest", packet);
        }
        if(packet instanceof ClientMovePacket && !this.isPacketOld(packet)) {
            this.player.position.set(packet.x, packet.y, packet.z);
            this.player.velocity.set(packet.vx, packet.vy, packet.vz);
            this.player.yaw = packet.yaw;
            this.player.pitch = packet.pitch;
            this.emit("move");
        }
        if(packet instanceof PlaceBlockPacket) {
            this.client.world.setColor(packet.x, packet.y, packet.z, this.client.world.getColorFromValue(packet.block));
            this.server.savers.get(this.client.world.name).saveModified();
        }
        if(packet instanceof BreakBlockPacket) {
            this.client.world.clearColor(packet.x, packet.y, packet.z);
        }
        if(packet instanceof PingResponsePacket && !this.isPacketOld(packet)) {
            if(this.onPingResponse != null) this.onPingResponse();
        }

        this.lastPacketReceived.set(packet.id, packet.timestamp);
    }

    public sendPacket(packet: Packet, instant: boolean = false) {
        const buffer = new ArrayBuffer(packet.getBufferSize());
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

            if(this.connected) {
                this.sendPacket(combinedPacket, true);
            } else {
                this.waitForConnection().then(() => {
                    this.sendPacket(combinedPacket, true);
                });
            }
        }
    }

    public async sendPing() {
        this.ping = await (this.pingPromise ??= new Promise<number>((res, rej) => {
            const pingPacket = new PingPacket;
            debugLog("ping");

            const t0 = performance.now();

            this.onPingResponse = () => {
                res(performance.now() - t0);
                this.pingPromise = null;
                this.onPingResponse = null;
            };

            setTimeout(() => {
                this.pingPromise = null;
                this.onPingResponse = null;
                rej(new TimedOutError("Ping timed out"));
            }, 5000);
            
            this.sendPacket(pingPacket, true);
        }));
    }

    public kick(reason: string = "Unknown reason") {
        if(this.connected) {
            // Ask the client to disconnect
            const packet = new KickPacket();
            packet.reason = reason;
            this.sendPacket(packet, true);

            console.log(packet);

            this.emit("disconnected", reason);
            this.connected = false; // Stop interpreting packets

            setTimeout(() => {
                this.connection.close(); // Force connection closed
            }, 2000);
        } else {
            this.connection.close();
        }
        debugLog("Kicked " + this.id + " for: " + reason);
    }
}