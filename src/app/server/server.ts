import { ServerPeer } from "./serverPeer";
import { World } from "../world";
import { MessagePortConnection } from "./thread";
import { Color } from "three";
import { debugLog } from "../logging";
import { WorldSaver } from "./worldSaver";
import { Packet, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket } from "../packet";
import { PlayerJoinEvent, PlayerLeaveEvent, ServerLoadedEvent, ServerPreinitEvent, WorldCreateEvent } from "./pluginEvents";
import { EventPublisher } from "./events";
import { ServerPlugin } from "./serverPlugin";
import { WorldGenerator } from "../worldGenerator";

export interface ServerOptions {
    worldName?: string;
    plugins?: ServerPlugin[];
}

export class Server extends EventPublisher {
    public worlds: Map<string, World> = new Map;
    public savers: Map<string, WorldSaver> = new Map;
    public peers: Map<string, ServerPeer> = new Map;
    public debugPort: MessagePort = null;
    public errorPort: MessagePort = null;
    public options: ServerOptions;
    public defaultWorldName: string = "world";
    public plugins: Set<ServerPlugin> = new Set;

    public constructor(options: ServerOptions) {
        super();

        this.options = options;
        if(options.plugins != null) for(const plugin of options.plugins) {
            this.addPlugin(plugin);
        }
        if(options.worldName != null) this.defaultWorldName = options.worldName;
    }

    public setDebugPort(port: MessagePort) {
        this.debugPort = port;
    }
    public setErrorPort(port: MessagePort) {
        this.errorPort = port;
    }

    public async createWorld(name: string, saving = true) {
        const world = new World(name, this);
        const saver = new WorldSaver(name, world);

        const event = new WorldCreateEvent(this);
        event.world = world;
        event.worldName = name;
        this.emit(event);

        if(event.isCancelled()) throw new Error("World creation cancelled");

        this.worlds.set(name, world);

        if(saving) {
            await saver.open();
            this.savers.set(name, saver);
        }

        return world;
    }

    public async start() {
        this.emit(new ServerPreinitEvent(this));
        const defaultWorld = await this.createWorld(this.defaultWorldName);
        defaultWorld.setGenerator(new WorldGenerator(defaultWorld));
        this.startLoop();

        this.emit(new ServerLoadedEvent(this));
        debugLog("Server loaded!");
    }

    private startLoop() {
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
        
        const world = this.worlds.get(this.defaultWorldName);
        peer.player.setWorld(world);

        this.peers.set(peer.id, peer);

        const joinEvent = new PlayerJoinEvent(this);
        joinEvent.peer = peer;
        joinEvent.player = peer.player;
        joinEvent.world = world;
        this.emit(joinEvent);

        if(joinEvent.isCancelled()) {
            connection.close();
            this.peers.delete(peer.id);
            return;
        }

        await new Promise<void>((res, rej) => {
            connection.once("open", () => res());
            connection.once("error", e => {
                this.handleDisconnection(peer, e);
                rej(e);
            });
        })

        connection.addListener("data", data => {
            try {
                if(data instanceof ArrayBuffer) {
                    peer.handlePacket(data);
                }
            } catch(e) {
                console.error(e);
                peer.kick(e.message);
            }
        });

        const joinPacket = new PlayerJoinPacket(peer.player);
        joinPacket.player = peer.id;

        for(const otherId of this.peers.keys()) {
            const otherPeer = this.peers.get(otherId);
            if(otherPeer == peer) continue;

            const otherJoinPacket = new PlayerJoinPacket(otherPeer.player);
            otherJoinPacket.player = otherId;

            peer.sendPacket(otherJoinPacket, true);
            otherPeer.sendPacket(joinPacket, true);
        }

        peer.addListener("disconnected", (cause) => {
            this.handleDisconnection(peer, cause);
            this.peers.delete(peer.id);
        });
    }

    public handleDisconnection(peer: ServerPeer, cause: { toString(): string }) {
        debugLog("Peer " + peer.id + " disconnected: " + cause.toString());

        const event = new PlayerLeaveEvent(this);
        event.peer = peer;
        event.player = peer.player;
        event.world = peer.player.world;
        this.emit(event);

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

    public async loadChunk(world: World, chunkX: number, chunkY: number, chunkZ: number) {
        let chunk = world.getChunk(chunkX, chunkY, chunkZ, false);

        if(chunk == null) {
            chunk = world.getChunk(chunkX, chunkY, chunkZ, true);

            const saver = this.savers.get(world.name);
            if(saver == null) {
                world.generateChunk(chunkX, chunkY, chunkZ);
            } else {
                const data = await saver.getChunkData(chunkX, chunkY, chunkZ);
                if(data == null) {
                    world.generateChunk(chunkX, chunkY, chunkZ);
                    saver.saveChunk(chunk);
                } else {
                    chunk.data.set(new Uint16Array(data));
                }
            }
        }

        return chunk;
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

    public addPlugin(plugin: ServerPlugin) {
        plugin.setServer(this);

        this.addSubscriber(plugin);
        this.plugins.add(plugin);
    }
    public removePlugin(plugin: ServerPlugin) {
        this.removeSubscriber(plugin);
        this.plugins.delete(plugin);
    }

    public getDefaultWorld() {
        return this.worlds.get(this.defaultWorldName);
    }
}