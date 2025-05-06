import { ServerPeer, TimedOutError } from "./serverPeer";
import { World } from "../world";
import { MessagePortConnection } from "./thread";
import { Color } from "three";
import { debugLog } from "../logging";
import { WorldSaver } from "./worldSaver";
import { Packet, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket } from "../packet";
import { PeerJoinEvent, PeerLeaveEvent, ServerLoadedEvent, ServerPreinitEvent, WorldCreateEvent } from "./pluginEvents";
import { EventPublisher } from "./events";
import { ServerPlugin } from "./serverPlugin";
import { WorldGenerator } from "../worldGenerator";
import { ServerReadyPacket } from "../packet/serverReadyPacket";
import { ClientReadyPacket } from "../packet/clientReadyPacket";
import { PluginLoader } from "./pluginLoader";
import { ServerData, ServerOptions } from "./serverData";

export interface ServerLaunchOptions {
    id: string;
}

export class Server extends EventPublisher {
    public id: string;
    public worlds: Map<string, World> = new Map;
    public savers: Map<string, WorldSaver> = new Map;
    public peers: Map<string, ServerPeer> = new Map;
    public debugPort: MessagePort = null;
    public errorPort: MessagePort = null;
    public options: ServerOptions;
    public launchOptions: ServerLaunchOptions;
    public data: ServerData;
    public plugins: Set<ServerPlugin> = new Set;

    public constructor(launchOptions: ServerLaunchOptions) {
        super();
        this.id = launchOptions.id;
    }

    public setDebugPort(port: MessagePort) {
        this.debugPort = port;
    }
    public setErrorPort(port: MessagePort) {
        this.errorPort = port;
    }

    public async createWorld(name: string, saving = true) {
        const descriptor = await this.data.createWorld(name);
        const world = new World(descriptor.id, this);
        const saver = new WorldSaver(this, descriptor.id, world);

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
        this.data = new ServerData(this.id, this.options);
        await this.data.open();
        await this.data.loadAll();

        try {
            for(const pluginName of this.options.plugins) {
                this.addPlugin(PluginLoader.createPlugin(pluginName));
            }
        } catch(e) {
            throw new Error("Failed to load plugins", { cause: e });
        }

        this.emit(new ServerPreinitEvent(this));
        const defaultWorld = await this.createWorld(this.options.defaultWorldName);
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
        
        const world = this.worlds.get(this.options.defaultWorldName);
        this.peers.set(peer.id, peer);

        peer.player.setWorld(world);

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

        const [_, clientReadyPacket] = await Promise.all([
            new Promise<void>((res, rej) => {
                connection.once("open", () => res());
                connection.once("error", e => {
                    this.handleDisconnection(peer, e);
                    rej(e);
                });
            }),
            new Promise<ClientReadyPacket>((res, rej) => {
                peer.once("clientready", packet => res(packet));
    
                setTimeout(() => {
                    if(!peer.connected) return;
                    rej(new TimedOutError("Connection timed out while handshaking"))
                }, 5000);
            })
        ]);

        const joinEvent = new PeerJoinEvent(this);
        joinEvent.peer = peer;
        joinEvent.player = peer.player;
        joinEvent.world = world;
        this.emit(joinEvent);

        if(joinEvent.isCancelled()) {
            connection.close();
            this.peers.delete(peer.id);
            return;
        }

        const serverReadyPacket = new ServerReadyPacket();
        serverReadyPacket.username = clientReadyPacket.username;
        serverReadyPacket.color = clientReadyPacket.color;
        peer.sendPacket(serverReadyPacket);

        // Send join messages
        peer.sendToWorld(world);

        peer.addListener("disconnected", (cause) => {
            this.handleDisconnection(peer, cause);
            this.peers.delete(peer.id);
        });
    }

    public handleDisconnection(peer: ServerPeer, cause: { toString(): string }) {
        debugLog("Peer " + peer.id + " disconnected: " + cause.toString());

        const event = new PeerLeaveEvent(this);
        event.peer = peer;
        event.player = peer.player;
        event.world = peer.player.world;
        this.emit(event);

        this.peers.delete(peer.id);

        for(const otherPeer of this.peers.values()) {
            otherPeer.hidePeer(peer);
        }
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

            const saver = this.savers.get(world.id);
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
        return this.worlds.get(this.options.defaultWorldName);
    }
}