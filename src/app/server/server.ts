import { BaseEntity, EntityLogicType, EntityRotation, instanceof_RotatingEntity, RotatingEntity } from "../entity/baseEntity";
import { Player } from "../entity/impl";
import { debugLog } from "../logging";
import { AddEntityPacket, CombinedPacket, combinePackets, EntityDataPacket, EntityMovePacket, Packet, RemoveEntityPacket, SetBlockPacket } from "../packet";
import { ClientReadyPacket } from "../packet/clientReadyPacket";
import { EntityLookPacket } from "../packet/entityLookPacket";
import { ServerReadyPacket } from "../packet/serverReadyPacket";
import { World } from "../world";
import { WorldGenerator } from "../worldGenerator";
import { EventPublisher } from "./events";
import { FlushPacketQueueEvent, PeerJoinEvent, PeerLeaveEvent, ServerLoadedEvent, ServerPreinitEvent, ServerTickEvent, WorldCreateEvent } from "./pluginEvents";
import { PluginLoader } from "./pluginLoader";
import { ServerData, ServerOptions } from "./serverData";
import { ServerPeer, TimedOutError } from "./serverPeer";
import { ServerPlugin } from "./serverPlugin";
import { MessagePortConnection, serverCrash } from "./thread";
import { WorldSaver } from "./worldSaver";

export interface ServerLaunchOptions {
    id: string;
    peerId?: string;
    overrideSettings?: Partial<ServerOptions>;
}

export class Server extends EventPublisher {
    public id: string;
    public peerId: string;
    public worlds: Map<string, World> = new Map;
    public savers: Map<string, WorldSaver> = new Map;
    public peers: Map<string, ServerPeer> = new Map;
    public debugPort: MessagePort = null;
    public errorPort: MessagePort = null;
    public options: ServerOptions = new ServerOptions;
    public launchOptions: ServerLaunchOptions;
    public data: ServerData;
    public plugins: Set<ServerPlugin> = new Set;
    public time: number;
    private worldSavingInterval: number;
    private packetFlushInterval: number;
    private tickingInterval: number;

    public constructor(launchOptions: ServerLaunchOptions) {
        super();
        this.launchOptions = launchOptions;
        this.id = launchOptions.id;
    }

    public setDebugPort(port: MessagePort) {
        this.debugPort = port;
    }
    public setErrorPort(port: MessagePort) {
        this.errorPort = port;
    }

    public async createWorld(name: string, saving = true) {
        const descriptor = this.data.worlds.get(name) ?? await this.data.createWorld(name);
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
            this.savers.set(descriptor.id, saver);
        }

        return world;
    }

    public async start() {
        this.data = new ServerData(this.id, this.options);
        await this.data.open();
        await this.data.loadAll();

        if(this.launchOptions.overrideSettings != null) {
            Object.assign(this.options, this.launchOptions.overrideSettings);
            await this.data.saveOptions();
        }

        try {
            for(const pluginName of new Set(this.options.plugins)) {
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
        this.worldSavingInterval = setInterval(() => {
            this.flushWorldUpdateQueue();
        }, 1000 / 2);

        this.packetFlushInterval = setInterval(() => {
            const time = this.time;

            const worldsWithPeers: Set<World> = new Set;

            for(const peer of this.peers.values()) {
                worldsWithPeers.add(peer.serverPlayer.world);
            }

            for(const world of this.worlds.values()) {
                if(!worldsWithPeers.has(world)) continue;

                for(const entity of world.entities.allEntities.values()) {
                    this.updateEntityLocation(entity, time, false);
                }
            }
            
            for(const peer of this.peers.values()) {
                const event = new FlushPacketQueueEvent(this);
                event.peer = peer;
                
                this.emit(event);
                if(!event.isCancelled()) peer.flushPacketQueue();
            }
        }, 1000 / 10);

        let lastTick = 0;
        this.tickingInterval = setInterval(() => {
            const time = this.time;
            const dt = Math.min(time - lastTick, 100) * 0.001;
            lastTick = time;

            const tickEvent = new ServerTickEvent(this);
            tickEvent.dt = dt;

            try {
                this.emit(tickEvent);

                for(const peer of this.peers.values()) {
                    peer.update(dt);
                }
            } catch(e) {
                serverCrash(new Error("Internal error whilst ticking", { cause: e }));
            }
        }, 1000 / 20);


        const animate = (time: number) => {
            this.time = time;
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }

    public updateEntityLocation(entity: BaseEntity, time: number, instant = true, teleport = false) {
        if(entity.logicType != EntityLogicType.LOCAL_LOGIC) return;
        if(entity instanceof Player) {
            // don't send automatic updates for player entities
            // this is handled differently when packets are received...
            return;
        }

        if(!entity.localLogic.hasMovedSince(time)) return;

        const movedLocation = entity.localLogic.hasMovedSince(time);
        const movedRotation = instanceof_RotatingEntity(entity) && entity.rotation.hasMovedSince(time);
        const packet = combinePackets(
            movedLocation ? new EntityMovePacket(entity, teleport): null,
            movedRotation ? new EntityLookPacket(entity): null
        );

        if(packet != null) this.broadcastPacket(packet, entity.world, instant);
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
        
        const world = this.getDefaultWorld();
        this.peers.set(peer.id, peer);

        peer.serverPlayer.setWorld(world);

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
        joinEvent.serverPlayer = peer.serverPlayer;
        joinEvent.player = peer.serverPlayer.base;
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
        event.serverPlayer = peer.serverPlayer;
        event.player = peer.serverPlayer.base;
        event.world = peer.serverPlayer.world;
        this.emit(event);

        this.peers.delete(peer.id);

        for(const otherPeer of this.peers.values()) {
            otherPeer.hidePeer(peer);
        }
    }

    public broadcastPacket(packet: Packet, world?: World, instant: boolean = false) {
        for(const id of this.peers.keys()) {
            const peer = this.peers.get(id);
            if(world == null || peer.serverPlayer.world == world) {
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

    public spawnEntity(entity: BaseEntity) {
        const packet = new AddEntityPacket(entity);
        this.broadcastPacket(packet, entity.world);
    }
    public updateEntity(entity: BaseEntity) {
        const packet = new EntityDataPacket(entity);
        this.broadcastPacket(packet, entity.world);
    }
    public removeEntity(entity: BaseEntity) {
        const packet = new RemoveEntityPacket(entity);
        this.broadcastPacket(packet, entity.world);
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
        clearInterval(this.worldSavingInterval);
        clearInterval(this.packetFlushInterval);
        clearInterval(this.tickingInterval);

        const promises: Promise<unknown>[] = [];
        for(const saver of this.savers.values()) {
            promises.push(saver.saveModified());
        }
        for(const plugin of this.plugins) {
            this.removeSubscriber(plugin);
            promises.push(plugin.close());
            this.plugins.delete(plugin);
        }
        for(const peer of this.peers.values()) {
            peer.kick("Server closing");
        }

        await Promise.all(promises);
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
    public getSaver(world: World) {
        return this.savers.get(world.id);
    }
}