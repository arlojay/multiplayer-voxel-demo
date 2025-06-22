import { BSON } from "bson";
import { BaseRegistries } from "../baseRegistries";
import { AirBlock } from "../block/airBlock";
import { SerializedBlock } from "../block/block";
import { BlockDataMemoizer } from "../block/blockDataMemoizer";
import { BlockRegistry } from "../block/blockRegistry";
import { ColorBlock } from "../block/colorBlock";
import { DataLibrary, DataLibraryManager } from "../data/dataLibrary";
import { LibraryDataFetchLocator } from "../data/libraryDataFetchLocator";
import { createLibraryDataNegotiationLocatorServer } from "../data/libraryDataNegotiationLocator";
import { BaseEntity, EntityLogicType, instanceof_RotatingEntity } from "../entity/baseEntity";
import { Player } from "../entity/impl";
import { debugLog } from "../logging";
import { GameContentPackage } from "../network/gameContentPackage";
import { NegotiationChannel } from "../network/negotiationChannel";
import { AddEntityPacket, combinePackets, EntityDataPacket, EntityMovePacket, Packet, RemoveEntityPacket, SetBlockPacket, SetSelectedBlockPacket } from "../packet";
import { EntityLookPacket } from "../packet/entityLookPacket";
import { ClientIdentity, ServerIdentity } from "../serverIdentity";
import { CHUNK_INC_SCL, CHUNK_X_INC_BYTE } from "../voxelGrid";
import { Chunk, World } from "../world";
import { WorldGenerator } from "../worldGenerator";
import { EventPublisher } from "./events";
import { FlushPacketQueueEvent, PeerJoinEvent, PeerLeaveEvent, ServerLoadedEvent, ServerPreinitEvent, ServerTickEvent, WorldCreateEvent } from "./pluginEvents";
import { PluginLoader } from "./pluginLoader";
import { ServerData, ServerOptions, WorldDescriptor } from "./serverData";
import { ServerPeer } from "./serverPeer";
import { ServerPlugin } from "./serverPlugin";
import { MessagePortConnection, serverCrash } from "./thread";
import { DatabaseChunk, WorldSaver } from "./worldSaver";
import { BlockStateSaveKey } from "../block/blockState";
import { Color } from "three";

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

    public dataLibraryManager: DataLibraryManager;
    public dataLibrary: DataLibrary;

    private worldSavingInterval: number | any;
    private packetFlushInterval: number | any;
    private tickingInterval: number | any;
    public registries: BaseRegistries;
    public blockDataMemoizer: BlockDataMemoizer;

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

    public async getWorld(name: string, saving = true) {
        let descriptor = this.data.worlds.get(name);
        if(descriptor == null) {
            const event = new WorldCreateEvent(this);
            event.worldName = name;
            this.emit(event);

            if(event.isCancelled()) throw new Error("World creation cancelled");
            descriptor = await this.data.createWorld(name);
        }
        const world = new World(descriptor.id, this.blockDataMemoizer, this);
        const saver = new WorldSaver(this, descriptor.id, world);

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


        this.loadPlugins();


        this.emit(new ServerPreinitEvent(this));


        this.dataLibraryManager = new DataLibraryManager("server");
        await this.dataLibraryManager.open();
        
        this.dataLibrary = await this.dataLibraryManager.getLibrary(this.id);
        await this.dataLibrary.open(new LibraryDataFetchLocator);

        await this.loadPluginContent();


        const defaultWorld = await this.getWorld(this.options.defaultWorldName);
        defaultWorld.setGenerator(new WorldGenerator(defaultWorld));


        this.startLoop();

        this.emit(new ServerLoadedEvent(this));
        debugLog("Server loaded!");
    }

    private loadPlugins() {
        try {
            const pluginList = PluginLoader.getPluginList();
            for(const pluginName of new Set(this.options.plugins)) {
                if(!pluginList.has(pluginName)) {
                    console.warn("Plugin " + pluginName + " does not exist");
                    continue;
                }
                this.addPlugin(PluginLoader.createPlugin(pluginName));
            }
        } catch(e) {
            throw new Error("Failed to load plugins", { cause: e });
        }
    }

    private async loadPluginContent() {
        const registries: BaseRegistries = {
            blocks: new BlockRegistry
        }

        registries.blocks.register("air", AirBlock);
        registries.blocks.register("color", ColorBlock);

        await Promise.all(this.plugins.values().map(plugin => 
            plugin.addContent(registries, this.dataLibrary)
        ))

        registries.blocks.freeze();

        await Promise.all(registries.blocks.values().map(block => 
            block.init(this.dataLibrary)
        ));

        this.registries = registries;
        this.blockDataMemoizer = new BlockDataMemoizer(registries.blocks, true);
        await this.blockDataMemoizer.memoize();
    }

    private startLoop() {
        this.worldSavingInterval = setInterval(() => {
            this.flushWorldUpdateQueue();
        }, 1000 * 5);

        this.packetFlushInterval = setInterval(() => {
            const time = this.time;

            const worldsWithPeers: Set<World> = new Set;

            for(const peer of this.peers.values()) {
                if(!peer.authenticated) continue;
                worldsWithPeers.add(peer.serverPlayer.world);
            }

            for(const world of this.worlds.values()) {
                if(!worldsWithPeers.has(world)) continue;

                for(const entity of world.entities.allEntities.values()) {
                    this.updateEntityLocation(entity, time, false);
                }
            }
            
            for(const peer of this.peers.values()) {
                if(!peer.authenticated) continue;

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
                    if(!peer.authenticated) continue;
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

    private async flushWorldUpdateQueue() {
        for(const worldName of this.worlds.keys()) {
            const world = this.worlds.get(worldName);

            if(world.dirtyChunkQueue.size == 0) continue;

            await this.savers.get(world.id)?.saveModified();

            for(const chunk of world.dirtyChunkQueue) {
                world.dirtyChunkQueue.delete(chunk);
            }
        }
    }

    public async handleConnection(connection: MessagePortConnection) {
        console.debug("New connection from " + connection.peer + " (label " + connection.label + ")");
        if(connection.label == "negotiation") {
            const peer = new ServerPeer(connection.peer, this);
            this.peers.set(peer.id, peer);

            const channel = new NegotiationChannel(connection);

            await new Promise<void>((res, rej) => {
                channel.onRequest<void, ServerIdentity>("identity", (req, res) => {
                    res.send({
                        uuid: this.id
                    });
                });
                channel.onRequest("content", (request, response) => {
                    const blocks: SerializedBlock[] = new Array;
                    for(const block of this.registries.blocks.values()) {
                        blocks.push(block.serialize());
                    }
                    response.send("hi", new TextEncoder().encode(JSON.stringify({ blocks })).buffer as ArrayBuffer);
                })
                channel.onRequest<ClientIdentity, ClientIdentity>("login", (request, response) => {
                    peer.setIdentity(request.data);
                    
                    for(const otherPeer of this.peers.values()) {
                        if(otherPeer == peer || !otherPeer.authenticated) continue;
            
                        if(otherPeer.username == peer.username) {
                            return response.error(0x01, "Username taken");
                        }
                    }
            
                    peer.serverPlayer.onAuthenticated();
                    peer.authenticated = true;

                    console.debug("<server> your specimen has been processed and you are now ready to join the game proper. hello " + request.data.username + ".");
                    response.send({
                        username: request.data.username,
                        color: request.data.color
                    });
                })
                channel.on("close", () => {
                    res();
                })
                
                createLibraryDataNegotiationLocatorServer(channel, this.dataLibrary);
                channel.open();
            });
        } else if(connection.label == "realtime") {
            const peer = this.peers.get(connection.peer);
            peer.onRealtimeCreated(connection);

            const world = this.getDefaultWorld();

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

            if(!connection.open) await new Promise<void>((res, rej) => {
                connection.once("open", () => res());
                connection.once("error", e => {
                    this.handleDisconnection(peer, e);
                    rej(e);
                });
            });

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

            // Send join messages
            peer.sendToWorld(world);

            peer.sendPacket(new SetSelectedBlockPacket("color#" + ColorBlock.getClosestColor("#" + peer.color) as BlockStateSaveKey));

            peer.addListener("disconnected", (cause) => {
                this.handleDisconnection(peer, cause);
                this.peers.delete(peer.id);
            });
        }
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
            if(!otherPeer.authenticated) continue;
            otherPeer.hidePeer(peer);
        }
    }

    public broadcastPacket(packet: Packet, world?: World, instant: boolean = false) {
        for(const peer of this.peers.values()) {
            if(!peer.authenticated) continue;
            if(world == null || peer.serverPlayer.world == world) {
                peer.sendPacket(packet, instant);
            }
        }
    }

    private chunkLoadingPromises: Map<Chunk, PromiseWithResolvers<void>> = new Map;

    public async loadChunk(world: World, chunkX: number, chunkY: number, chunkZ: number) {
        let chunk = world.getChunk(chunkX, chunkY, chunkZ, false);

        if(chunk == null) {
            chunk = world.getChunk(chunkX, chunkY, chunkZ, true);
            
            const saver = this.savers.get(world.id);
            if(saver == null) {
                world.generateChunk(chunk);
            } else {
                const promise = Promise.withResolvers<void>();
                this.chunkLoadingPromises.set(chunk, promise);
                const chunkData = await saver.getChunkData(chunkX, chunkY, chunkZ);

                if(chunkData == null) {
                    world.generateChunk(chunk);
                    await saver.saveChunk(chunk);
                } else {
                    const migrated = this.tryMigrateChunk(chunkData);
                    chunk.data.set(new Uint16Array(chunkData.data));
                    chunk.setPalette(chunkData.palette ?? []);
                    if(migrated) await saver.saveChunk(chunk);
                }
                promise.resolve();
                this.chunkLoadingPromises.delete(chunk);
            }
        } else {
            await this.chunkLoadingPromises.get(chunk)?.promise;
        }

        return chunk;
    }

    private tryMigrateChunk(chunk: DatabaseChunk) {
        let upgraded = false;
        if(chunk.version == null) {
            chunk.version = 1;

            chunk.palette = [ "air#default" ];
            const remaps: Map<number, number> = new Map([ [0, 0] ]);

            function nextPaletteId() {
                let i = 0;
                while(chunk.palette[i] != null) i++;
                return i;
            }

            const blockData = new Uint16Array(chunk.data);
            const allBlocks = Array.from(this.registries.blocks.values());
            for(let i = 0; i < 4096; i++) {
                const blockId = blockData[i];

                if(!remaps.has(blockId)) {
                    console.debug("generate remap for " + blockId.toString(2).padStart(16, "0"));
                    if(blockId & 0b1000000000000000) { // colored block
                        const r = (blockId & 0b0111110000000000) >> 10;
                        const g = (blockId & 0b0000001111100000) >> 5;
                        const b = (blockId & 0b0000000000011111) >> 0;

                        const color = new Color;
                        color.r = r / 31;
                        color.g = g / 31;
                        color.b = b / 31;

                        // console.log(blockId, color);

                        const colorString = ColorBlock.getClosestColor(color);

                        const newId = nextPaletteId();
                        chunk.palette[newId] = "color#" + colorString as BlockStateSaveKey;

                        remaps.set(blockId, newId);
                    } else { // custom block
                        const block = allBlocks[blockId];
                        const newId = nextPaletteId();

                        if(block == null) {
                            console.warn("Unknown block " + blockId + " at " + Math.floor(i / 256) + ", " + (i % 16) + ", " + (Math.floor(i / 16) % 16) + "; making air", allBlocks);
                            remaps.set(blockId, 0);
                        } else {
                            const states = Array.from(block.states.keys());
                            chunk.palette[newId] = block.id + "#" + states[0] as BlockStateSaveKey;

                            remaps.set(blockId, newId);
                        }
                    }
                }
                blockData[i] = remaps.get(blockId);
            }
            console.debug("Migrated chunk " + chunk.position.join(", ") + " to version 1");
            upgraded = true;
        }

        return upgraded;
    }

    public createBlockUpdatePacket(world: World, x: number, y: number, z: number) {
        const packet = new SetBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;

        const chunk = world.getChunk(x >> CHUNK_INC_SCL, y >> CHUNK_INC_SCL, z >> CHUNK_INC_SCL);
        packet.block = chunk.getBlockStateKey(x - chunk.blockX, y - chunk.blockY, z - chunk.blockZ);

        return packet;
    }

    public updateBlock(world: World, x: number, y: number, z: number) {        
        this.broadcastPacket(this.createBlockUpdatePacket(world, x, y, z), world);
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
            if(!peer.authenticated) continue;
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