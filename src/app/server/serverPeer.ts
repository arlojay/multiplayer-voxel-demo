import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryBuffer } from "../binary";
import { debugLog } from "../logging";
import { BreakBlockPacket, ChangeWorldPacket, ChunkDataPacket, ClientMovePacket, CombinedPacket, GetChunkPacket, KickPacket, Packet, PingPacket, PingResponsePacket, PlaceBlockPacket, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket } from "../packet";
import { Server } from "./server";
import { ServerPlayer } from "./serverPlayer";
import { MessagePortConnection } from "./thread";
import { CHUNK_INC_SCL } from "../voxelGrid";
import { ServerUI } from "./serverUI";
import { UIContainer } from "../ui";
import { BreakBlockEvent, PeerMoveEvent, PlaceBlockEvent } from "./pluginEvents";
import { World } from "../world";
import { ClientReadyPacket } from "../packet/clientReadyPacket";

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
    public player: ServerPlayer = null;
    private packetQueue: Set<ArrayBuffer> = new Set;
    private pingPromise: Promise<number> = null;
    public ping: number = 0;
    private onPingResponse: () => void = null;
    private lastPacketReceived: Map<number, number> = new Map;
    private visiblePeers: Set<ServerPeer> = new Set;
    public authenticated = false;
    public username = "anonymous";
    public color = "#ffffff";


    constructor(connection: MessagePortConnection, server: Server) {
        super();
        this.connection = connection;
        this.id = connection.peer;
        this.server = server;

        this.player = new ServerPlayer(this);

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

        this.emit("clientready", packet);
        this.authenticated = true;
    }

    public handlePacket(data: ArrayBuffer) {
        if(!this.connected) return;

        const packet = Packet.createFromBinary(data);

        if(packet instanceof ClientReadyPacket) {
            this.authenticate(packet);
        } else if(!this.authenticated) {
            throw new Error("Client not authenticated");
        }

        if(packet instanceof GetChunkPacket) {
            this.server.loadChunk(this.player.world, packet.x, packet.y, packet.z).then(chunk => {
                const responsePacket = new ChunkDataPacket(packet); // shorthand response
                responsePacket.data.set(chunk.data);
                
                this.sendPacket(responsePacket);
            })
        }
        if(packet instanceof ClientMovePacket && !this.isPacketOld(packet)) {
            if(!this.player.world.blocks.chunkExists(packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL)) {
                this.player.syncPosition();
                return;
            }

            const wasColliding = this.player.collisionChecker.isCollidingWithWorld(-0.01);
            const oldPosition = this.player.position.clone();
            this.player.position.set(packet.x, packet.y, packet.z);
            const isColliding = this.player.collisionChecker.isCollidingWithWorld(-0.01);

            if(isColliding) {
                if(wasColliding) {
                    this.player.respawn();
                } else {
                    this.player.velocity.set(0, 0, 0);
                    this.player.position.copy(oldPosition);
                    this.player.syncPosition();
                }
            } else {
                this.player.velocity.set(packet.vx, packet.vy, packet.vz);
                this.player.yaw = packet.yaw;
                this.player.pitch = packet.pitch;
            }

            
            const event = new PeerMoveEvent(this.server);
            event.peer = this;
            event.player = this.player;
            event.world = this.player.world;
            event.x = packet.x;
            event.y = packet.y;
            event.z = packet.z;
            event.vx = packet.vx;
            event.vy = packet.vy;
            event.vz = packet.vz;
            event.yaw = packet.yaw;
            event.pitch = packet.pitch;
            this.server.emit(event);

            if(event.isCancelled()) {
                this.player.velocity.set(0, 0, 0);
                this.player.position.copy(oldPosition);
                this.player.syncPosition();
            } else {
                const broadcastPacket = new PlayerMovePacket(this.player);
                broadcastPacket.player = this.id;
    
                for(const otherPeer of this.server.peers.values()) {
                    if(otherPeer == this) continue;
                    if(otherPeer.player.world != this.player.world) continue;
    
                    otherPeer.sendPacket(broadcastPacket, true);
                }
            }
        }
        if(packet instanceof PlaceBlockPacket) {
            const event = new PlaceBlockEvent(this.server);
            event.peer = this;
            event.player = this.player;
            event.world = this.player.world;
            event.x = packet.x;
            event.y = packet.y;
            event.z = packet.z;
            event.block = packet.block;
            this.server.emit(event);

            if(event.isCancelled()) {
                this.updateBlock(packet.x, packet.y, packet.z);
            } else {
                this.server.loadChunk(this.player.world, packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL).then(() => {
                    this.player.world.setColor(packet.x, packet.y, packet.z, this.player.world.getColorFromValue(packet.block));
                    this.server.getSaver(this.player.world)?.saveModified();
                });
            }
        }
        if(packet instanceof BreakBlockPacket) {
            const event = new BreakBlockEvent(this.server);
            event.peer = this;
            event.player = this.player;
            event.world = this.player.world;
            event.x = packet.x;
            event.y = packet.y;
            event.z = packet.z;
            this.server.emit(event);

            if(event.isCancelled()) {
                this.updateBlock(packet.x, packet.y, packet.z);
            } else {
                this.server.loadChunk(this.player.world, packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL).then(() => {
                    this.player.world.clearColor(packet.x, packet.y, packet.z);
                    this.server.getSaver(this.player.world)?.saveModified();
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
    public sendPacket(packet: Packet, instant: boolean = false) {
        const buffer = new ArrayBuffer(packet.getBufferSize());
        packet.write(new BinaryBuffer(buffer));

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

    public updateBlock(x: number, y: number, z: number) {
        const packet = new SetBlockPacket();
        packet.x = x;
        packet.y = y;
        packet.z = z;
        packet.block = this.player.world.getRawValue(x, y, z, false);
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

    public showUI(ui: UIContainer): ServerUI {
        const uiInstance = new ServerUI(this, ui);
        uiInstance.open();

        return uiInstance;
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
        this.player.update(dt);
    }

    public sendToWorld(world: World) {
        this.player.setWorld(world);
        this.sendPacket(new ChangeWorldPacket(world));

        for(const otherPeer of this.server.peers.values()) {
            if(otherPeer.player.world == this.player.world) {
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

        const joinPacket = new PlayerJoinPacket(peer);
        joinPacket.player = peer.id;
        this.visiblePeers.add(peer);

        this.sendPacket(joinPacket);
    }
    public hidePeer(peer: ServerPeer) {
        if(peer == this) return;
        if(!this.visiblePeers.has(peer)) return;

        const leavePacket = new PlayerLeavePacket();
        leavePacket.player = peer.id;
        this.visiblePeers.delete(peer);

        this.sendPacket(leavePacket);
    }
}