import { TypedEmitter } from "tiny-typed-emitter";
import { ServerPeer } from "./serverPeer";
import { ChunkDataPacket, Packet, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket } from "../packet/packet";
import { World } from "../world";
import { MessagePortConnection } from "./thread";
import { Color } from "three";
import { debugLog } from "../logging";
import { WorldSaver } from "./worldSaver";
import { VoxelGridChunk } from "../voxelGrid";

interface ServerEvents {
    "connection": (peer: ServerPeer) => void;
}

export interface ServerOptions {
    worldName?: string;
}

export class Server extends TypedEmitter<ServerEvents> {
    public worlds: Map<string, World> = new Map;
    public savers: Map<string, WorldSaver> = new Map;
    public peers: Map<string, ServerPeer> = new Map;
    public debugPort: MessagePort = null;
    public errorPort: MessagePort = null;
    public options: ServerOptions;
    public defaultWorldName: string = "world";

    public constructor(options: ServerOptions) {
        super();
        this.options = options;
        if(options.worldName != null) this.defaultWorldName = options.worldName;
    }

    public setDebugPort(port: MessagePort) {
        this.debugPort = port;
    }
    public setErrorPort(port: MessagePort) {
        this.errorPort = port;
    }

    public async createWorld(name: string) {
        const world = new World(name, this);
        const saver = new WorldSaver(name, world);

        await saver.open();

        this.worlds.set(name, world);
        this.savers.set(name, saver);
    }

    public async start() {
        await this.createWorld(this.defaultWorldName);
        this.startLoop();

        debugLog("Server loaded!");
    }

    private startLoop() {
        const mainWorld = this.worlds.get(this.defaultWorldName);
        const color = new Color;
        setInterval(() => {
            this.flushWorldUpdateQueue();
        }, 1000 / 2);

        setInterval(() => {
            for(const peer of this.peers.values()) {
                peer.flushPacketQueue();
            }
        }, 1000 / 10);

        let lastTick = 0;
        setInterval(() => {
            const time = performance.now();
            const dt = Math.min(time - lastTick, 100) * 0.001;
            lastTick = time;

            for(const peer of this.peers.values()) {
                peer.update(dt);
            }
        }, 1000 / 20);
    }

    private flushWorldUpdateQueue() {
        for(const id of this.worlds.keys()) {
            const world = this.worlds.get(id);

            for(const chunk of world.dirtyChunkQueue) {

                
                world.dirtyChunkQueue.delete(chunk);
            }
        }
    }

    public async handleConnection(connection: MessagePortConnection) {
        const peer = new ServerPeer(connection, this);
        this.debugPort = connection.debugPort;
        this.errorPort = connection.errorPort;
        
        peer.player.setWorld(this.worlds.get(this.defaultWorldName));
        peer.player.respawn();

        peer.addListener("chunkrequest", async packet => {
            const world = peer.player.world;
            const voxelWorld = world.blocks;
            let chunk: VoxelGridChunk = voxelWorld.getChunk(packet.x, packet.y, packet.z, false);

            if(chunk == null) {
                chunk = voxelWorld.getChunk(packet.x, packet.y, packet.z, true);

                const saver = this.savers.get(world.name);
                const data = await saver.getChunkData(packet.x, packet.y, packet.z);
                if(data == null) {
                    world.generateChunk(packet.x, packet.y, packet.z);
                    saver.saveChunk(chunk);
                } else {
                    chunk.data.set(new Uint16Array(data));
                }
            }

            const responsePacket = new ChunkDataPacket;
            responsePacket.x = packet.x;
            responsePacket.y = packet.y;
            responsePacket.z = packet.z;
            responsePacket.data.set(chunk.data);
            
            peer.sendPacket(responsePacket);
        });
        peer.addListener("move", () => {
            const packet = new PlayerMovePacket(peer.player);
            packet.player = peer.id;

            for(const otherId of this.peers.keys()) {
                if(otherId == peer.id) continue;

                this.peers.get(otherId).sendPacket(packet, true);
            }
        })

        await new Promise<void>((res, rej) => {
            connection.once("open", () => res());
            connection.once("error", e => {
                this.handleDisconnection(peer, e);
                rej(e);
            });
        })

        connection.addListener("data", data => {
            if(data instanceof ArrayBuffer) {
                peer.handlePacket(data);
            }
        });

        const joinPacket = new PlayerJoinPacket(peer.player);
        joinPacket.player = peer.id;
        this.broadcastPacket(joinPacket, null, true);

        for(const otherId of this.peers.keys()) {
            const joinPacket = new PlayerJoinPacket(this.peers.get(otherId).player);
            joinPacket.player = otherId;

            peer.sendPacket(joinPacket, true);
        }

        peer.addListener("disconnected", (cause) => {
            this.handleDisconnection(peer, cause);
            this.peers.delete(peer.id);
        });

        this.peers.set(peer.id, peer);
        this.emit("connection", peer);
    }

    public handleDisconnection(peer: ServerPeer, cause: { toString(): string }) {
        debugLog("Peer " + peer.id + " disconnected: " + cause.toString());

        this.peers.delete(peer.id);
        
        const leavePacket = new PlayerLeavePacket;
        leavePacket.player = peer.id;
        this.broadcastPacket(leavePacket, null, true);
    }

    public broadcastPacket(packet: Packet, world?: World, instant: boolean = false) {
        for(const id of this.peers.keys()) {
            const peer = this.peers.get(id);
            if(world == null || peer.player.world == world) {
                peer.sendPacket(packet, instant);
            }
        }
    }



    public updateBlock(world: World, x: number, y: number, z: number) {
        const packet = new SetBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;
        packet.block = world.blocks.get(x, y, z);
        
        this.broadcastPacket(packet, world);
    }

    public logDebug(text: string) {
        if(this.debugPort == null) return;
        this.debugPort.postMessage(text);
    }

    public logError(text: string) {
        if(this.errorPort == null) return;
        this.errorPort.postMessage(text);
    }

    public async close() {
        for await(const saver of this.savers.values()) {
            await saver.saveModified();
        }
    }
}