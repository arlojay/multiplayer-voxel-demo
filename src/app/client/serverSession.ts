import { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryWriter, U16 } from "../binary";
import { ChunkDataPacket, ClientMovePacket, CombinedPacket, GetChunkPacket, KickPacket, Packet, PingPacket, PingResponsePacket, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket, SetLocalPlayerPositionPacket } from "../packet/packet";
import { World } from "../world";
import { Client } from "./client";
import { LocalPlayer } from "./localPlayer";
import { Box3, Vector3 } from "three";
import { RemotePlayer } from "./remotePlayer";
import { debugLog } from "../logging";
import { CHUNK_INC_SCL } from "../voxelGrid";
import { VoxelGridVolume } from "../voxelGridVolume";
import { LoopingMusic } from "../sound/loopingMusic";

interface ServerSessionEvents {
    "disconnected": (reason: string) => void;
    "playerjoin": (player: RemotePlayer) => void;
    "playerleave": (player: RemotePlayer) => void;
}

export class ServerSession extends TypedEmitter<ServerSessionEvents> {
    public client: Client;
    public serverConnection: DataConnection;
    public player: LocalPlayer;
    public localWorld = new World;
    public players: Map<string, RemotePlayer> = new Map;

    private lastPlayerPosition: Vector3 = new Vector3;
    private lastPlayerVelocity: Vector3 = new Vector3;
    private lastPlayerPitch: number = 0;
    private lastPlayerYaw: number = 0;
    
    private lastPacketReceived: Map<number, number> = new Map;
    private waitingChunks: Map<string, (packet: ChunkDataPacket) => void> = new Map;
    private kicked: boolean;
    private loadedChunks: VoxelGridVolume;
    private lastViewDistance = -Infinity;

    public constructor(client: Client) {
        super();
        this.client = client;

        const clip = client.audioManager.loadSound("assets/sounds/foxslit.wav");
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
            this.localWorld.setRawValue(packet.x, packet.y, packet.z, packet.block);
        }
        if(packet instanceof ChunkDataPacket) {
            const promise = this.waitingChunks.get(packet.x + ";" + packet.y + ";" + packet.z);
            if(promise != null) promise(packet);
        }
        if(packet instanceof PlayerMovePacket && !this.isPacketOld(packet)) {
            const player = this.players.get(packet.player);
            if(player == null) throw new ReferenceError("Player " + packet.player + " does not exist");

            player.position.set(packet.x, packet.y, packet.z);
            player.velocity.set(packet.vx, packet.vy, packet.vz);
            player.yaw = packet.yaw;
            player.pitch = packet.pitch;

            player.resetTimer();
        }
        if(packet instanceof PlayerJoinPacket) {
            const remotePlayer = new RemotePlayer(packet.player);
            remotePlayer.position.set(packet.x, packet.y, packet.z);
            remotePlayer.velocity.set(packet.vx, packet.vy, packet.vz);
            remotePlayer.yaw = packet.yaw;
            remotePlayer.pitch = packet.pitch;
            remotePlayer.setWorld(this.localWorld);
            this.players.set(packet.player, remotePlayer);
            debugLog("Player " + packet.player + " joined the game");

            this.emit("playerjoin", remotePlayer);
        }
        if(packet instanceof PlayerLeavePacket) {
            const player = this.players.get(packet.player);
            if(player == null) throw new ReferenceError("Player " + packet.player + " does not exist");

            this.emit("playerleave", player);
            this.players.delete(packet.player);
            debugLog("Player " + packet.player + " left the game");
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
        
        this.lastPacketReceived.set(packet.id, packet.timestamp);
    }

    public sendPacket(packet: Packet) {
        const buffer = new ArrayBuffer(packet.getBufferSize());
        packet.write(new BinaryWriter(buffer));
        this.serverConnection.send(buffer);
    }

    public fetchChunk(x: number, y: number, z: number) {
        const packet = new GetChunkPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;

        this.sendPacket(packet);

        return new Promise<ChunkDataPacket>(res => {
            this.waitingChunks.set(x + ";" + y + ";" + z, packet => res(packet));
        });
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



        for(const id of this.players.keys()) {
            const player = this.players.get(id);

            player.update(dt);
        }
    }

    private onConnected() {
        this.player = new LocalPlayer;
        this.player.setWorld(this.localWorld);
        this.player.position.set(0, 10, 0);
        this.player.setController(this.client.playerController);
    }

    public updateViewDistance() {
        const r = this.client.gameData.clientOptions.viewDistance;

        if(this.lastViewDistance != this.client.gameData.clientOptions.viewDistance) {
            this.loadedChunks = new VoxelGridVolume(new Box3(
                new Vector3(-r, -r, -r),
                new Vector3( r,  r,  r)
            ));
        }

        this.loadedChunks.fill(0);

        const localChunkX = this.player.position.x >> CHUNK_INC_SCL;
        const localChunkY = this.player.position.y >> CHUNK_INC_SCL;
        const localChunkZ = this.player.position.z >> CHUNK_INC_SCL;

        const onFetchResponse = (response: ChunkDataPacket) => {
            const { x, y, z } = response;

            const localChunk = this.localWorld.blocks.getChunk(x, y, z);
            localChunk.data.set(response.data);

            const nx = this.loadedChunks.get(x - 1, y, z);
            const px = this.loadedChunks.get(x + 1, y, z);
            const ny = this.loadedChunks.get(x, y - 1, z);
            const py = this.loadedChunks.get(x, y + 1, z);
            const nz = this.loadedChunks.get(x, y, z - 1);
            const pz = this.loadedChunks.get(x, y, z + 1);

            if(nx == 0) return;
            if(px == 0) return;
            if(ny == 0) return;
            if(py == 0) return;
            if(nz == 0) return;
            if(pz == 0) return;

            this.localWorld.markChunkDirty(localChunk);

            if(nx == 5) this.localWorld.markChunkDirty(this.localWorld.blocks.getChunk(x - 1, y, z));
            if(px == 5) this.localWorld.markChunkDirty(this.localWorld.blocks.getChunk(x + 1, y, z));
            if(ny == 5) this.localWorld.markChunkDirty(this.localWorld.blocks.getChunk(x, y - 1, z));
            if(py == 5) this.localWorld.markChunkDirty(this.localWorld.blocks.getChunk(x, y + 1, z));
            if(nz == 5) this.localWorld.markChunkDirty(this.localWorld.blocks.getChunk(x, y, z - 1));
            if(pz == 5) this.localWorld.markChunkDirty(this.localWorld.blocks.getChunk(x, y, z + 1));

            this.loadedChunks.set(x - 1, y, z, nx + 1);
            this.loadedChunks.set(x + 1, y, z, px + 1);
            this.loadedChunks.set(x, y - 1, z, ny + 1);
            this.loadedChunks.set(x, y + 1, z, py + 1);
            this.loadedChunks.set(x, y, z - 1, nz + 1);
            this.loadedChunks.set(x, y, z + 1, pz + 1);
        }

        for(let x = localChunkX - r; x <= localChunkX + r; x++) {
            for(let y = localChunkY - r; y <= localChunkY + r; y++) {
                for(let z = localChunkZ - r; z <= localChunkZ + r; z++) {
                    if(!this.localWorld.blocks.chunkExists(x, y, z)) continue;

                    this.loadedChunks.set(x, y, z, 1);
                }
            }
        }

        for(let x = localChunkX - r; x <= localChunkX + r; x++) {
            for(let y = localChunkY - r; y <= localChunkY + r; y++) {
                for(let z = localChunkZ - r; z <= localChunkZ + r; z++) {
                    let count = 0;
                    if(this.loadedChunks.get(x - 1, y, z) > 0) count++;
                    if(this.loadedChunks.get(x - 1, y, z) > 0) count++;
                    if(this.loadedChunks.get(x - 1, y, z) > 0) count++;
                    if(this.loadedChunks.get(x - 1, y, z) > 0) count++;
                    if(this.loadedChunks.get(x - 1, y, z) > 0) count++;
                    if(this.loadedChunks.get(x - 1, y, z) > 0) count++;
                    this.loadedChunks.set(x, y, z, count);

                    if(count > 0) continue;
                    
                    this.fetchChunk(x, y, z).then(onFetchResponse);
                }
            }
        }
    }
}