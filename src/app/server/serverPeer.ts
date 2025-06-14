import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryBuffer } from "../binary";
import { debugLog } from "../logging";
import { AddEntityPacket, BreakBlockPacket, ChangeWorldPacket, ChunkDataPacket, ClientMovePacket, CombinedPacket, EntityMovePacket, GetChunkPacket, KickPacket, Packet, packetRegistry, PingPacket, PingResponsePacket, PlaceBlockPacket, RemoveEntityPacket, SetBlockPacket, splitPacket, SplitPacket, SplitPacketAssembler } from "../packet";
import { ClientReadyPacket } from "../packet/clientReadyPacket";
import { UIContainer } from "../ui";
import { CHUNK_INC_SCL } from "../voxelGrid";
import { World } from "../world";
import { BreakBlockEvent, PlaceBlockEvent } from "./pluginEvents";
import { Server } from "./server";
import { ServerPlayer } from "./serverPlayer";
import { ServerUI } from "./serverUI";
import { MessagePortConnection } from "./thread";
import { EntityLookPacket } from "../packet/entityLookPacket";

interface ServerPeerEvents {
    "chunkrequest": (packet: GetChunkPacket) => void;
    "disconnected": (cause: string) => void;
    "packet": (packet: Packet) => void;
    "clientready": (packet: ClientReadyPacket) => void;
}

export class TimedOutError extends Error {

}

export class ServerPeer extends TypedEmitter<ServerPeerEvents> {
    public connection: MessagePortConnection;
    public connected: boolean = false;
    public id: string;
    public server: Server;
    public serverPlayer: ServerPlayer = null;
    private packetQueue: Set<ArrayBuffer> = new Set;
    private pingPromise: Promise<number> = null;
    public ping: number = 0;
    private onPingResponse: () => void = null;
    private lastPacketReceived: Map<number, number> = new Map;
    private visiblePeers: Set<ServerPeer> = new Set;
    private splitPacketAssembler = new SplitPacketAssembler;
    public authenticated = false;
    public username = "anonymous";
    public color = "#ffffff";
    public lastPacketTime = 0;


    constructor(connection: MessagePortConnection, server: Server) {
        super();
        this.connection = connection;
        this.id = connection.peer;
        this.server = server;

        this.serverPlayer = new ServerPlayer(this);

        connection.addListener("open", () => {
            this.connected = true;
            this.lastPacketTime = this.server.time;
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
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch(e) {
            this.kick("Internal server error");
            throw e;
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

    private authenticate(packet: ClientReadyPacket) {
        this.username = packet.username;
        this.color = packet.color;

        for(const peer of this.server.peers.values()) {
            if(peer == this) continue;

            if(peer.username == this.username) {
                this.kick("Username taken");
                return;
            }
        }

        this.serverPlayer.onAuthenticated();
        this.emit("clientready", packet);
        this.authenticated = true;
    }

    public handlePacket(data: ArrayBuffer | Packet) {
        if(!this.connected) return;
        this.lastPacketTime = this.server.time;

        let packet = data instanceof Packet ? data : packetRegistry.createFromBinary(data);
        if(data instanceof SplitPacket) {
            data = this.splitPacketAssembler.addPart(data);
            if(data == null) return;
            packet = packetRegistry.createFromBinary(data);
        }

        if(packet instanceof ClientReadyPacket) {
            this.authenticate(packet);
        } else if(!this.authenticated) {
            throw new Error("Client not authenticated");
        }

        if(packet instanceof GetChunkPacket) {
            this.server.loadChunk(this.serverPlayer.world, packet.x, packet.y, packet.z).then(chunk => {
                this.sendPacket(new ChunkDataPacket(chunk));
            })
        }
        if(packet instanceof ClientMovePacket && !this.isPacketOld(packet)) {
            const success = this.serverPlayer.handleMovement(packet);

            if(success) {
                this.serverPlayer.world.entities.updateEntityLocation(this.serverPlayer.base);
                const broadcastPacket = new CombinedPacket();
                broadcastPacket.addPacket(new EntityMovePacket(this.serverPlayer.base));
                broadcastPacket.addPacket(new EntityLookPacket(this.serverPlayer.base));
    
                for(const otherPeer of this.server.peers.values()) {
                    if(otherPeer == this) continue;
                    if(otherPeer.serverPlayer.world != this.serverPlayer.world) continue;
    
                    otherPeer.sendPacket(broadcastPacket, true);
                }
            }
        }
        if(packet instanceof PlaceBlockPacket) {
            const event = new PlaceBlockEvent(this.server);
            event.peer = this;
            event.serverPlayer = this.serverPlayer;
            event.player = this.serverPlayer.base;
            event.world = this.serverPlayer.world;
            event.x = packet.x;
            event.y = packet.y;
            event.z = packet.z;
            event.block = packet.block;
            this.server.emit(event);

            if(event.isCancelled()) {
                this.updateBlock(packet.x, packet.y, packet.z);
            } else {
                this.server.loadChunk(this.serverPlayer.world, packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL).then(() => {
                    this.serverPlayer.world.setColor(packet.x, packet.y, packet.z, this.serverPlayer.world.getColorFromValue(packet.block));
                    this.server.getSaver(this.serverPlayer.world)?.saveModified();
                });
            }
        }
        if(packet instanceof BreakBlockPacket) {
            const event = new BreakBlockEvent(this.server);
            event.peer = this;
            event.serverPlayer = this.serverPlayer;
            event.player = this.serverPlayer.base;
            event.world = this.serverPlayer.world;
            event.x = packet.x;
            event.y = packet.y;
            event.z = packet.z;
            this.server.emit(event);

            if(event.isCancelled()) {
                this.updateBlock(packet.x, packet.y, packet.z);
            } else {
                this.server.loadChunk(this.serverPlayer.world, packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL).then(() => {
                    this.serverPlayer.world.clearColor(packet.x, packet.y, packet.z);
                    this.server.getSaver(this.serverPlayer.world)?.saveModified();
                });
            }
        }
        if(packet instanceof PingResponsePacket && !this.isPacketOld(packet)) {
            if(this.onPingResponse != null) this.onPingResponse();
        }

        
        this.emit("packet", packet);
        this.lastPacketReceived.set(packet.id, packet.timestamp);
    }

    // TODO: refactor for "add to queue" instead of "send instantly" flag
    public sendPacket(masterPacket: Packet, instant: boolean = false) {
        for(const packet of splitPacket(masterPacket)) {
            const buffer = packet.allocateBuffer();
            try {
                packet.write(new BinaryBuffer(buffer));
            } catch(e) {
                throw new Error("Failed to write packet " + (packet.constructor?.name), { cause: e });
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
    }

    public updateBlock(x: number, y: number, z: number) {
        const packet = new SetBlockPacket();
        packet.x = x;
        packet.y = y;
        packet.z = z;
        packet.block = this.serverPlayer.world.getRawValue(x, y, z, false);
        this.sendPacket(packet);
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

            if(this.connected) {
                // No benefit from bundling a singular packet
                if(combinedPacket.packets.size == 1) {
                    for(const packet of combinedPacket.packets) this.connection.send(packet);
                    continue;
                }

                this.sendPacket(combinedPacket, true);
            } else {
                this.waitForConnection().then(() => {
                    this.sendPacket(combinedPacket, true);
                });
            }
        }
    }

    public showUI(ui: UIContainer): ServerUI {
        const uiInstance = new ServerUI(this, ui);
        uiInstance.open();

        return uiInstance;
    }

    public async sendPing() {
        this.ping = await (this.pingPromise ??= new Promise<number>((res, rej) => {
            const pingPacket = new PingPacket;
            const t0 = performance.now();

            this.onPingResponse = () => {
                res(performance.now() - t0);
                this.pingPromise = null;
                this.onPingResponse = null;
            };
            
            this.sendPacket(pingPacket, true);
        }));
    }

    public kick(reason: string = "Unknown reason") {
        if(this.connected) {
            // Ask the client to disconnect
            const packet = new KickPacket();
            packet.reason = reason;
            this.sendPacket(packet, true);

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

    public update(dt: number) {
        this.serverPlayer.update(dt);

        if(!this.connected) return;
        if(this.lastPacketTime + 5000 < this.server.time) {
            this.kick("Timed out");
        }
    }

    public sendToWorld(world: World) {
        this.serverPlayer.setWorld(world);
        this.sendPacket(new ChangeWorldPacket(world));

        for(const otherPeer of this.server.peers.values()) {
            if(otherPeer.serverPlayer.world == this.serverPlayer.world) {
                this.showPeer(otherPeer);
                otherPeer.showPeer(this);
            } else {
                this.hidePeer(otherPeer);
                otherPeer.hidePeer(this);
            }
        }
    }

    public showPeer(peer: ServerPeer) {
        if(peer == this) return;
        if(this.visiblePeers.has(peer)) return;

        const joinPacket = new AddEntityPacket(peer.serverPlayer.base);
        this.visiblePeers.add(peer);

        this.sendPacket(joinPacket);
    }
    public hidePeer(peer: ServerPeer) {
        if(peer == this) return;
        if(!this.visiblePeers.has(peer)) return;

        const leavePacket = new RemoveEntityPacket(peer.serverPlayer.base);
        this.visiblePeers.delete(peer);

        this.sendPacket(leavePacket);
    }
}