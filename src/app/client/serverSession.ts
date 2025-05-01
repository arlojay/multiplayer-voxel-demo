import FastPriorityQueue from "fastpriorityqueue";
import { DataConnection } from "peerjs";
import { Vector3 } from "three";
import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryBuffer } from "../binary";
import { debugLog } from "../logging";
import { ChunkDataPacket, ClientMovePacket, CloseUIPacket, CombinedPacket, GetChunkPacket, KickPacket, Packet, PingPacket, PingResponsePacket, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket, SetLocalPlayerPositionPacket, OpenUIPacket, UIInteractionPacket, ChangeWorldPacket, RemoveUIElementPacket, InsertUIElementPacket } from "../packet";
import { LoopingMusic } from "../sound/loopingMusic";
import { World } from "../world";
import { Client } from "./client";
import { LocalPlayer } from "./localPlayer";
import { RemotePlayer } from "./remotePlayer";
import { CHUNK_INC_SCL } from "../voxelGrid";
import { NetworkUI } from "../client/networkUI";
import { ServerReadyPacket } from "../packet/serverReadyPacket";
import { UIElement } from "../ui";

interface ServerSessionEvents {
    "disconnected": (reason: string) => void;
    "playerjoin": (player: RemotePlayer) => void;
    "playerleave": (player: RemotePlayer) => void;
    "changeworld": (world: World) => void;
}
export class ServerSession extends TypedEmitter<ServerSessionEvents> {
    public client: Client;
    public serverConnection: DataConnection;
    public player: LocalPlayer;
    public localWorld = new World;
    public players: Map<string, RemotePlayer> = new Map;
    public interfaces: Map<string, NetworkUI> = new Map;

    private lastPlayerPosition: Vector3 = new Vector3;
    private lastPlayerVelocity: Vector3 = new Vector3;
    private lastPlayerPitch: number = 0;
    private lastPlayerYaw: number = 0;
    
    private lastPacketReceived: Map<number, number> = new Map;
    private waitingChunks: Map<string, (packet: ChunkDataPacket) => void> = new Map;
    private fetchingChunks: Map<string, Promise<ChunkDataPacket>> = new Map;
    private chunkFetchingQueue: FastPriorityQueue<GetChunkPacket> = new FastPriorityQueue(
        (a, b) => (a.x * a.x + a.y * a.y + a.z * a.z) < (b.x * b.x + b.y * b.y + b.z * b.z)
    )
    private kicked: boolean;

    public constructor(client: Client) {
        super();
        this.client = client;

        const clip = client.audioManager.loadSound("assets/sounds/foxslit.mp3");
        const music = new LoopingMusic(clip, 60 / 163 * 4 * 40);
        music.volume = 0.1;
        music.resume();
    }
    
    public async connect(serverId: string) {
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
    
    private initConnectionEvents() {
        this.serverConnection.addListener("data", data => {
            if(data instanceof ArrayBuffer) {
                this.handlePacket(data);
            }
        });
        this.serverConnection.addListener("close", () => {
            if(this.kicked) return;

            this.emit("disconnected", "Connection lost");
        })
    }

    private isPacketOld(packet: Packet) {
        return this.lastPacketReceived.get(packet.id) > packet.timestamp;
    }
    
    public handlePacket(data: ArrayBuffer) {
        const packet = Packet.createFromBinary(data);
        
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
            const key = packet.x + ";" + packet.y + ";" + packet.z;
            const promise = this.waitingChunks.get(key);
            if(promise != null) promise(packet);
            this.waitingChunks.delete(key);
        }
        if(packet instanceof PlayerMovePacket && !this.isPacketOld(packet)) {
            const player = this.players.get(packet.player);
            if(player == null) {
                console.warn("Cannot move player " + packet.player + " as they do not exist");
            } else {
                player.position.set(packet.x, packet.y, packet.z);
                player.velocity.set(packet.vx, packet.vy, packet.vz);
                player.yaw = packet.yaw;
                player.pitch = packet.pitch;

                player.resetTimer();
            }
        }
        if(packet instanceof PlayerJoinPacket) {
            const remotePlayer = new RemotePlayer(packet.player);
            remotePlayer.username = packet.username;
            remotePlayer.color = packet.color;
            remotePlayer.position.set(packet.x, packet.y, packet.z);
            remotePlayer.velocity.set(packet.vx, packet.vy, packet.vz);
            remotePlayer.yaw = packet.yaw;
            remotePlayer.pitch = packet.pitch;
            remotePlayer.setWorld(this.localWorld);
            
            remotePlayer.createModel().then(() => {
                this.players.set(packet.player, remotePlayer);
                debugLog("Player " + packet.player + " joined the game");
                this.emit("playerjoin", remotePlayer);
            })
        }
        if(packet instanceof PlayerLeavePacket) {
            const player = this.players.get(packet.player);
            if(player == null) {
                console.warn("Cannot remove nonexistent player " + packet.player);
            } else {
                this.emit("playerleave", player);
                this.players.delete(packet.player);
                debugLog("Player " + packet.player + " left the game");
            }
        }
        if(packet instanceof PingPacket && !this.isPacketOld(packet)) {
            const responsePacket = new PingResponsePacket();
            this.sendPacket(responsePacket);
        }
        if(packet instanceof KickPacket) {
            this.emit("disconnected", packet.reason);
            this.kicked = true;
            this.serverConnection.close();
        }
        if(packet instanceof SetLocalPlayerPositionPacket) {
            this.player.position.set(packet.x, packet.y, packet.z);
            this.player.velocity.set(packet.vx, packet.vy, packet.vz);
            this.player.pitch = packet.pitch;
            this.player.yaw = packet.yaw;
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
        // console.log("send packet", packet);
        const buffer = new ArrayBuffer(packet.getBufferSize());
        packet.write(new BinaryBuffer(buffer));
        // console.log(new Uint8Array(buffer));
        this.serverConnection.send(buffer);
    }

    public updateChunkFetchQueue(dt: number) {
        for(let i = 0; i < 10; i++) {
            const packet = this.chunkFetchingQueue.poll();
            if(packet == null) return;

            this.sendPacket(packet);
        }
        this.chunkFetchingQueue.trim();
    }

    public resetLocalWorld() {
        this.localWorld = new World;
        this.fetchingChunks.clear();
        this.chunkFetchingQueue.removeMany(() => true);
        this.player.setWorld(this.localWorld);
        this.emit("changeworld", this.localWorld);
    }

    public fetchChunk(x: number, y: number, z: number) {
        const key = x + ";" + y + ";" + z;

        if(this.fetchingChunks.has(key)) return this.fetchingChunks.get(key);

        const packet = new GetChunkPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;

        this.chunkFetchingQueue.add(packet);

        const promise = new Promise<ChunkDataPacket>(res => {
            this.waitingChunks.set(key, packet => {
                this.addChunkData(packet);
                this.fetchingChunks.delete(key);
            });
        });
        this.fetchingChunks.set(key, promise);
        return promise;
    }
    public addChunkData(chunkDataPacket: ChunkDataPacket) {
        const { x, y, z } = chunkDataPacket;

        const localChunk = this.localWorld.getChunk(x, y, z, true);
        localChunk.data.set(chunkDataPacket.data);
        
        const nx = this.localWorld.getChunk(x - 1, y, z, false);
        if(nx != null) {
            localChunk.hasNegX = true;
            nx.hasPosX = true;
            if(nx.isFullySurrounded()) this.player.world.markChunkDirty(nx);
        }
        const px = this.localWorld.getChunk(x + 1, y, z, false);
        if(px != null) {
            localChunk.hasPosX = true;
            px.hasNegX = true;
            if(px.isFullySurrounded()) this.player.world.markChunkDirty(px);
        }
        const ny = this.localWorld.getChunk(y - 1, y, z, false);
        if(ny != null) {
            localChunk.hasNegY = true;
            ny.hasPosY = true;
            if(ny.isFullySurrounded()) this.player.world.markChunkDirty(ny);
        }
        const py = this.localWorld.getChunk(y + 1, y, z, false);
        if(py != null) {
            localChunk.hasPosY = true;
            py.hasNegY = true;
            if(py.isFullySurrounded()) this.player.world.markChunkDirty(py);
        }
        const nz = this.localWorld.getChunk(z - 1, y, z, false);
        if(nz != null) {
            localChunk.hasNegZ = true;
            nz.hasPosZ = true;
            if(nz.isFullySurrounded()) this.player.world.markChunkDirty(nz);
        }
        const pz = this.localWorld.getChunk(z + 1, y, z, false);
        if(pz != null) {
            localChunk.hasPosZ = true;
            pz.hasNegZ = true;
            if(pz.isFullySurrounded()) this.player.world.markChunkDirty(pz);
        }

        if(localChunk.isFullySurrounded()) {
            this.player.world.markChunkDirty(localChunk);
        }
    }
    public update(time: number, dt: number) {
        this.player.update(dt);

        const playerCamera = this.player.camera;
        const rendererCamera = this.client.gameRenderer.camera;

        rendererCamera.position.copy(playerCamera.position);
        rendererCamera.quaternion.copy(playerCamera.quaternion);
        rendererCamera.fov = playerCamera.fov;
        rendererCamera.updateProjectionMatrix();



        let playerMoved = false;
        if(this.player.position.clone().sub(this.lastPlayerPosition).length() > 0.01) {
            this.lastPlayerPosition.copy(this.player.position);
            playerMoved = true;
        }
        if(this.player.velocity.clone().sub(this.lastPlayerVelocity).length() > 0.01) {
            this.lastPlayerVelocity.copy(this.player.velocity);
            playerMoved = true;
        }
        if(this.player.yaw != this.lastPlayerYaw) {
            this.lastPlayerYaw = this.player.yaw;
            playerMoved = true;
        }
        if(this.player.pitch != this.lastPlayerPitch) {
            this.lastPlayerPitch = this.player.pitch;
            playerMoved = true;
        }

        if(playerMoved) {
            const movementPacket = new ClientMovePacket;
            movementPacket.x = this.player.position.x;
            movementPacket.y = this.player.position.y;
            movementPacket.z = this.player.position.z;
            movementPacket.vx = this.player.velocity.x;
            movementPacket.vy = this.player.velocity.y;
            movementPacket.vz = this.player.velocity.z;
            movementPacket.yaw = this.player.yaw;
            movementPacket.pitch = this.player.pitch;
            this.sendPacket(movementPacket);
        }



        for(const id of this.players.keys()) {
            const player = this.players.get(id);

            player.update(dt);
        }

        this.updateChunkFetchQueue(dt);
    }

    private onConnected() {
        this.player = new LocalPlayer;
        this.player.setWorld(this.localWorld);
        this.player.position.set(0, 10, 0);
        this.player.setController(this.client.playerController);
    }

    public updateViewDistance() {
        const r = this.client.gameData.clientOptions.viewDistance + 1;
        const rsq = r * r;

        const centerX = this.player.chunkX;
        const centerY = this.player.chunkY;
        const centerZ = this.player.chunkZ;

        for(let x = -r; x < r; x++) {
            for(let y = -r; y < r; y++) {
                for(let z = -r; z < r; z++) {
                    if(x * x + y * y + z * z > rsq) continue;
                    if(this.localWorld.chunkExists(x + centerX, y + centerY, z + centerZ)) continue;

                    this.fetchChunk(x + centerX, y + centerY, z + centerZ);
                }
            }
        }
    }
}