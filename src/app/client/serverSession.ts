import FastPriorityQueue from "fastpriorityqueue";
import { DataConnection } from "peerjs";
import { Vector3 } from "three";
import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryBuffer } from "../binary";
import { NetworkUI } from "../client/networkUI";
import { EntityLogicType, entityRegistry, EntityRotation, instanceof_RotatingEntity } from "../entity/baseEntity";
import { Player } from "../entity/impl";
import { debugLog } from "../logging";
import { ChangeWorldPacket, ChunkDataPacket, ClientMovePacket, CloseUIPacket, CombinedPacket, EntityDataPacket, EntityMovePacket, GetChunkPacket, InsertUIElementPacket, KickPacket, OpenUIPacket, Packet, packetRegistry, PingPacket, PingResponsePacket, RemoveEntityPacket, RemoveUIElementPacket, SetBlockPacket, SetLocalPlayerPositionPacket, UIInteractionPacket } from "../packet";
import { AddEntityPacket } from "../packet/addEntityPacket";
import { ServerReadyPacket } from "../packet/serverReadyPacket";
import { LoopingMusic } from "../sound/loopingMusic";
import { UIElement } from "../ui";
import { CHUNK_INC_SCL } from "../voxelGrid";
import { Chunk, World } from "../world";
import { Client } from "./client";
import { EntityLookPacket } from "../packet/entityLookPacket";

interface ServerSessionEvents {
    "disconnected": (reason: string) => void;
    "changeworld": (world: World) => void;
}

interface QueuedChunkPacket {
    packet: GetChunkPacket;
    distance: number;
    key: string;
}

export class ServerSession extends TypedEmitter<ServerSessionEvents> {
    public client: Client;
    public serverConnection: DataConnection;
    public player: Player;
    public localWorld = new World(crypto.randomUUID());
    // public players: Map<string, RemotePlayer> = new Map;
    public interfaces: Map<string, NetworkUI> = new Map;
    
    private lastPacketReceived: Map<number, number> = new Map;
    private waitingChunks: Map<string, { reject: () => void, resolve: (packet: ChunkDataPacket) => void }> = new Map;
    private fetchingChunks: Map<string, Promise<ChunkDataPacket>> = new Map;
    private chunkFetchingQueueMap: Map<string, QueuedChunkPacket> = new Map;
    private chunkFetchingQueue: FastPriorityQueue<QueuedChunkPacket> = new FastPriorityQueue(
        (a, b) => a.distance < b.distance
    );
    private kicked: boolean;
    private loadedChunksA: Chunk[] = new Array;
    private loadedChunksB: Chunk[] = new Array;
    private usingChunkBufferB = false;
    private chunksToCheckForLoading: number[][] = new Array;
    public music: LoopingMusic;

    public constructor(client: Client) {
        super();
        this.client = client;

        const clip = client.audioManager.loadSound("assets/sounds/foxslit.mp3");
        this.music = new LoopingMusic(clip, 60 / 163 * 4 * 40);
        this.music.volume = 0.1;
        this.music.resume();
    }
    
    public async connect(serverId: string) {
        if(this.client.peer.disconnected) await this.client.login();
        
        const connection = this.client.peer.connect(serverId, { serialization: "raw" });
        this.serverConnection = connection;
        
        await new Promise<void>((res, rej) => {
            connection.once("open", () => res());
            connection.once("error", (error) => {
                rej(new Error("Cannot connect to server " + serverId, { cause: error }));
            });
            connection.once("close", () => {
                rej(new Error("Cannot connect to server " + serverId));
            });

            setTimeout(() => {
                rej(new Error("Cannot connect to server " + serverId, { cause: new Error("Connection timed out") }));
            }, 10000);
        });

        debugLog("Connected to the server " + serverId + "!");
        this.initConnectionEvents();

        this.onConnected();
    }

    public close() {
        this.serverConnection.close();
        this.onDisconnected();
        this.emit("disconnected", "Cancelled by user");
    }
    
    private initConnectionEvents() {
        this.serverConnection.addListener("data", data => {
            if(data instanceof ArrayBuffer) {
                this.handlePacket(data);
            }
        });
        this.serverConnection.addListener("close", () => {
            if(this.kicked) return;

            this.onDisconnected();
            this.emit("disconnected", "Connection lost");
        })
    }

    private isPacketOld(packet: Packet) {
        return this.lastPacketReceived.get(packet.id) > packet.timestamp;
    }
    
    // TODO: make this less cancerous
    public handlePacket(data: ArrayBuffer) {
        const packet = packetRegistry.createFromBinary(data);
        
        if(packet instanceof CombinedPacket) {
            for(const subPacket of packet.packets) {
                this.handlePacket(subPacket);
            }
        }
        if(packet instanceof SetBlockPacket) {
            if(this.localWorld.chunkExists(packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL)) {
                this.localWorld.setRawValue(packet.x, packet.y, packet.z, packet.block);
            }
        }
        if(packet instanceof ChunkDataPacket) {
            if(packet.entityData != null) console.log(packet);
            const key = packet.x + ";" + packet.y + ";" + packet.z;
            const promise = this.waitingChunks.get(key);
            if(promise != null) promise.resolve(packet);
            this.waitingChunks.delete(key);
        }
        // if(packet instanceof PlayerMovePacket && !this.isPacketOld(packet)) {
        //     const player = this.players.get(packet.player);
        //     if(player == null) {
        //         console.warn("Cannot move player " + packet.player + " as they do not exist");
        //     } else {
        //         player.position.set(packet.x, packet.y, packet.z);
        //         player.velocity.set(packet.vx, packet.vy, packet.vz);
        //         player.yaw = packet.yaw;
        //         player.pitch = packet.pitch;

        //         player.resetTimer();
        //     }
        // }
        if(packet instanceof EntityMovePacket && !this.isPacketOld(packet)) {
            const entity = this.localWorld.getEntityByUUID(packet.uuid);
            if(entity == null) {
                console.warn("Cannot find entity " + packet.uuid + "!");
            } else {
                entity.position.set(packet.x, packet.y, packet.z);
                entity.velocity.set(packet.vx, packet.vy, packet.vz);

                entity.remoteLogic?.onMoved();
                entity.remoteLogic?.resetTimer();

                if(packet.skipInterpolation) {
                    entity.remoteLogic?.renderPosition.copy(entity.remoteLogic.position);
                }
            }
        }
        if(packet instanceof EntityLookPacket && !this.isPacketOld(packet)) {
            const entity = this.localWorld.getEntityByUUID(packet.uuid);
            if(entity == null) {
                console.warn("Cannot find entity " + packet.uuid + "!");
            } else if(instanceof_RotatingEntity(entity)) {
                entity.rotation.pitch = packet.pitch;
                entity.rotation.yaw = packet.yaw;
            }
        }
        if(packet instanceof EntityDataPacket && !this.isPacketOld(packet)) {
            const entity = this.localWorld.getEntityByUUID(packet.uuid);
            if(entity == null) {
                console.warn("Cannot find entity " + packet.uuid + "!");
            } else {
                entity.readExtraData(new BinaryBuffer(packet.data));
                entity.remoteLogic?.onUpdated();
            }
        }
        if(packet instanceof AddEntityPacket) {
            const remoteEntity = entityRegistry.createFromBinary(packet.entityData, EntityLogicType.REMOTE_LOGIC);
            this.localWorld.addEntity(remoteEntity);
            
            remoteEntity.remoteLogic.onAdd(this.client.gameRenderer.scene);
        }
        // if(packet instanceof PlayerJoinPacket) {
        //     const remotePlayer = new Player(EntityLogicType.REMOTE_LOGIC);
        //     remotePlayer.setWorld(this.localWorld);
            
        //     this.players.set(packet.player, remotePlayer);
        //     debugLog("Player " + packet.player + " joined the game");
        //     this.emit("playerjoin", remotePlayer);
        // }
        if(packet instanceof RemoveEntityPacket) {
            const remoteEntity = this.localWorld.getEntityByUUID(packet.uuid);
            if(remoteEntity == null) {
                console.warn("Cannot find entity " + packet.uuid + "!");
            } else {
                this.localWorld.removeEntity(remoteEntity);
                remoteEntity.remoteLogic.onRemove();
            }
        }
        // if(packet instanceof PlayerLeavePacket) {
        //     const player = this.players.get(packet.player);
        //     if(player == null) {
        //         console.warn("Cannot remove nonexistent player " + packet.player);
        //     } else {
        //         this.emit("playerleave", player);
        //         this.players.delete(packet.player);
        //         debugLog("Player " + packet.player + " left the game");
        //     }
        // }
        if(packet instanceof PingPacket && !this.isPacketOld(packet)) {
            const responsePacket = new PingResponsePacket();
            this.sendPacket(responsePacket);
        }
        if(packet instanceof KickPacket) {
            this.onDisconnected();
            this.emit("disconnected", packet.reason);
            this.kicked = true;
            this.serverConnection.close();
        }
        if(packet instanceof SetLocalPlayerPositionPacket) {
            this.player.position.copy(packet.position);
            this.player.velocity.copy(packet.velocity);
            this.player.rotation.pitch = packet.pitch;
            this.player.rotation.yaw = packet.yaw;
        }
        if(packet instanceof OpenUIPacket) {
            const ui = new NetworkUI(packet.ui, packet.interfaceId);
            this.interfaces.set(packet.interfaceId, ui);

            this.showUI(ui);
        }
        if(packet instanceof CloseUIPacket) {
            this.hideUI(packet.interfaceId);
        }
        if(packet instanceof RemoveUIElementPacket) {
            const ui = this.interfaces.get(packet.interfaceId);
            ui?.removeElement(packet.path);
        }
        if(packet instanceof InsertUIElementPacket) {
            const ui = this.interfaces.get(packet.interfaceId);
            ui?.insertElement(packet.path, UIElement.deserialize(packet.element));
        }
        if(packet instanceof ChangeWorldPacket) {
            this.resetLocalWorld();
        }
        if(packet instanceof ServerReadyPacket) {
            this.player.username = packet.username;
            this.player.color = packet.color;
        }
        
        this.lastPacketReceived.set(packet.id, packet.timestamp);
    }
    private onDisconnected() {
        this.chunkFetchingQueue.forEach(v => this.chunkFetchingQueue.remove(v));
        this.chunkFetchingQueueMap.clear();
        this.fetchingChunks.clear();
        this.loadedChunksA.splice(0);
        this.loadedChunksB.splice(0);

        for(const promise of this.waitingChunks.values()) {
            promise.reject();
        }
        this.waitingChunks.clear();

        this.music.destroy();
    }

    private showUI(ui: NetworkUI) {
        this.client.gameRenderer.showUI(ui.root);
        ui.addListener("interaction", (path, interaction, data) => {
            const packet = new UIInteractionPacket();
            packet.interfaceId = ui.id;
            packet.path = path;
            packet.interaction = interaction;
            packet.data = data ?? {};
            this.sendPacket(packet);
        });
    }
    private hideUI(ui: NetworkUI | string) {
        if(ui instanceof NetworkUI) {
            this.client.gameRenderer.hideUI(ui.root);
        } else if(typeof ui == "string") {
            this.hideUI(this.interfaces.get(ui));
        }
    }

    public sendPacket(packet: Packet) {
        const buffer = packet.allocateBuffer();
        try {
            packet.write(new BinaryBuffer(buffer));
        } catch(e) {
            throw new Error("Failed to write packet " + (packet.constructor?.name), { cause: e });
        }
        this.serverConnection.send(buffer);
    }

    public updateChunkFetchQueue(dt: number) {
        this.updateChunksToCheckForLoading(dt);

        const loadSize = Math.sqrt((this.client.gameData.clientOptions.viewDistance * 2 + 1) ** 2);
        const unloadSizeSquare = (this.client.gameData.clientOptions.viewDistance + 1) ** 2;

        for(let i = 0; i < 4; i++) {
            const queuedPacket = this.chunkFetchingQueue.poll();
            if(queuedPacket == null) break;

            if(queuedPacket.distance > loadSize) {
                i--;
                continue;
            }

            this.sendPacket(queuedPacket.packet);
        }
        this.chunkFetchingQueue.trim();

        // Add two for (a) one-expanded pre-loading radius, and (b) to prevent potential flickering
        const chunkBufferPrimary = this.usingChunkBufferB ? this.loadedChunksB : this.loadedChunksA;
        const chunkBufferSecondary = this.usingChunkBufferB ? this.loadedChunksA : this.loadedChunksB;
        const count = Math.max(4, Math.min(32, chunkBufferPrimary.length / 4));

        for(let i = 0; i < count; i++) {
            if(chunkBufferPrimary.length <= 0) {
                this.usingChunkBufferB = !this.usingChunkBufferB;
                break;
            }
            this.updateUnloadQueue(unloadSizeSquare, chunkBufferPrimary, chunkBufferSecondary);
        }
    }

    private updateChunksToCheckForLoading(dt: number) {
        let pos = [ 0, 0, 0 ];
        let i = 0;

        const count = Math.min(500, this.client.gameRenderer.framerate ** (2/3));
        
        while(i < count && this.chunksToCheckForLoading.length > 0) {
            pos = this.chunksToCheckForLoading.pop();
            if(pos == null) continue;
            if(this.localWorld.chunkExists(pos[0], pos[1], pos[2])) continue;

            this.fetchChunk(pos[0], pos[1], pos[2]);
            i++;
        }
    }

    public updateUnloadQueue(removeSizeSquare: number, chunkBufferPrimary: Chunk[], chunkBufferSecondary: Chunk[]) {
        const chunk = chunkBufferPrimary.pop();
        if(chunk == null) return;

        const distance = (
            (chunk.x - this.player.chunkX) ** 2 +
            (chunk.y - this.player.chunkY) ** 2 +
            (chunk.z - this.player.chunkZ) ** 2
        )
        if(distance <= removeSizeSquare) {
            chunkBufferSecondary.push(chunk);
            return;
        }

        this.unloadChunk(chunk);
    }

    public unloadChunk(chunk: Chunk) {
        if(chunk.hasMesh()) {
            chunk.mesh.parent.remove(chunk.mesh);
            chunk.deleteMesh();
        }
        this.localWorld.deleteChunk(chunk.x, chunk.y, chunk.z);
    }

    public resetLocalWorld() {
        this.localWorld = new World(crypto.randomUUID());
        this.fetchingChunks.clear();
        this.chunkFetchingQueue.removeMany(() => true);
        this.player.setWorld(this.localWorld);
        this.emit("changeworld", this.localWorld);
    }

    public fetchChunk(x: number, y: number, z: number) {
        const key = x + ";" + y + ";" + z;
        const distance = Math.sqrt(
            (x - this.player.chunkX) ** 2 +
            (y - this.player.chunkY) ** 2 +
            (z - this.player.chunkZ) ** 2
        );

        if(this.fetchingChunks.has(key)) {
            const queuedPacket = this.chunkFetchingQueueMap.get(key);
            this.chunkFetchingQueue.removeOne(v => v == queuedPacket);
            this.chunkFetchingQueue.add({
                distance, packet: queuedPacket.packet, key
            });
            return this.fetchingChunks.get(key);
        }

        const packet = new GetChunkPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;

        const queuedPacket = { packet, distance, key };
        this.chunkFetchingQueue.add(queuedPacket);
        this.chunkFetchingQueueMap.set(key, queuedPacket);

        const promise = new Promise<ChunkDataPacket>((res, rej) => {
            this.waitingChunks.set(key, {
                resolve: packet => {
                    this.addChunkData(packet);
                    this.fetchingChunks.delete(key);
                    this.chunkFetchingQueueMap.delete(key);
                },
                reject: () => {
                    // rej();
                }
            });
        });
        this.fetchingChunks.set(key, promise);
        return promise;
    }
    public addChunkData(chunkDataPacket: ChunkDataPacket) {
        const { x, y, z, entityData } = chunkDataPacket;

        const localChunk = this.localWorld.getChunk(x, y, z, true);
        localChunk.data.set(chunkDataPacket.data);

        for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
                for(let dz = -1; dz <= 1; dz++) {
                    if(dx == 0 && dy == 0 && dz == 0) continue;

                    const chunk = this.localWorld.getChunk(x + dx, y + dy, z + dz, false);
                    if(chunk == null) continue;
                    
                    localChunk.markSurrounded(dx, dy, dz);
                    chunk.markSurrounded(-dx, -dy, -dz);
                    if(chunk.isFullySurrounded()) this.player.world.markChunkDirty(chunk);
                }
            }
        }

        if(entityData != null) {
            for(const buffer of entityData) {
                const entity = entityRegistry.createFromBinary(buffer, EntityLogicType.REMOTE_LOGIC);
                console.log(entity);
                this.localWorld.addEntity(entity);
                entity.remoteLogic.onAdd(this.client.gameRenderer.scene);
            }
        }

        if(localChunk.isFullySurrounded()) {
            this.player.world.markChunkDirty(localChunk);
        }

        this.loadedChunksA.push(localChunk);
    }
    public update(time: number, dt: number) {
        this.player.update(dt);

        const playerCamera = this.player.localLogic.camera;
        const rendererCamera = this.client.gameRenderer.camera;

        rendererCamera.position.copy(playerCamera.position);
        rendererCamera.quaternion.copy(playerCamera.quaternion);
        rendererCamera.fov = playerCamera.fov;
        rendererCamera.updateProjectionMatrix();

        if(this.player.localLogic.hasMovedSince(time) || this.player.rotation.hasMovedSince(time)) {
            const movementPacket = new ClientMovePacket(this.player);
            this.sendPacket(movementPacket);
        }

        this.localWorld.update(dt);

        this.updateChunkFetchQueue(dt);
    }

    private onConnected() {
        this.player = new Player(EntityLogicType.LOCAL_LOGIC);
        this.player.setWorld(this.localWorld);
        this.player.position.set(0, 10, 0);
        this.player.localLogic.setController(this.client.playerController);
        this.client.gameRenderer.scene.add(this.player.localLogic.model.mesh);
    }

    public updateViewDistance() {
        const r = this.client.gameData.clientOptions.viewDistance + 1;
        const rsq = r * r;

        const centerX = this.player.chunkX;
        const centerY = this.player.chunkY;
        const centerZ = this.player.chunkZ;

        if(this.chunksToCheckForLoading.length > 100) return;

        for(let x = Math.floor(-r); x <= Math.floor(r); x++) {
            for(let y = Math.floor(-r); y <= Math.floor(r); y++) {
                for(let z = Math.floor(-r); z <= Math.floor(r); z++) {
                    if(x * x + y * y + z * z > rsq) continue;
                    this.chunksToCheckForLoading.push([ x + centerX, y + centerY, z + centerZ ]);
                }
            }
        }
    }
}