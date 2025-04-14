import { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryBuffer, U16 } from "../binary";
import { ChunkDataPacket, ClientMovePacket, CombinedPacket, GetChunkPacket, KickPacket, Packet, PingPacket, PingResponsePacket, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket, SetLocalPlayerPositionPacket } from "../packet/packet";
import { World } from "../world";
import { Client } from "./client";
import { LocalPlayer } from "./localPlayer";
import { Box3, Scene, Vector3 } from "three";
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
            const key = packet.x + ";" + packet.y + ";" + packet.z;
            const promise = this.waitingChunks.get(key);
            if(promise != null) promise(packet);
            this.waitingChunks.delete(key);
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
        packet.write(new BinaryBuffer(buffer));
        this.serverConnection.send(buffer);
    }

    public fetchChunk(x: number, y: number, z: number) {
        const packet = new GetChunkPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;

        this.sendPacket(packet);

        const key = x + ";" + y + ";" + z;

        const previousResolve = this.waitingChunks.get(key);

        return new Promise<ChunkDataPacket>(res => {
            this.waitingChunks.set(key, packet => {
                previousResolve?.(packet);
                res(packet);
            });
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

        const loadedChunks = new VoxelGridVolume(new Box3(
            new Vector3(-r - 1, -r - 1, -r - 1),
            new Vector3( r + 1,  r + 1,  r + 1)
        ));

        loadedChunks.fill(0b00000000);

        console.log(loadedChunks);

        const centerX = this.player.chunkX;
        const centerY = this.player.chunkY;
        const centerZ = this.player.chunkZ;

        const onFetchResponse = (response: ChunkDataPacket) => {
            const { x, y, z } = response;

            const localChunk = this.localWorld.blocks.getChunk(x, y, z, true);
            localChunk.data.set(response.data);

            const rx = x - centerX;
            const ry = y - centerY;
            const rz = z - centerZ;

            const nx = loadedChunks.get(rx - 1, ry, rz);
            const px = loadedChunks.get(rx + 1, ry, rz);
            const ny = loadedChunks.get(rx, ry - 1, rz);
            const py = loadedChunks.get(rx, ry + 1, rz);
            const nz = loadedChunks.get(rx, ry, rz - 1);
            const pz = loadedChunks.get(rx, ry, rz + 1);

            let surrounded = true;
            if(nx & 0b00100000) {
                if(~(nx & 0b00111111) & 0b00000010) this.localWorld.markDirtyByPos(x - 1, y, z);
            } else surrounded = false;
            if(px & 0b00100000) {
                if(~(px & 0b00111111) & 0b00000001) this.localWorld.markDirtyByPos(x + 1, y, z);
            } else surrounded = false;
            if(ny & 0b00100000) {
                if(~(ny & 0b00111111) & 0b00001000) this.localWorld.markDirtyByPos(x, y - 1, z);
            } else surrounded = false;
            if(py & 0b00100000) {
                if(~(py & 0b00111111) & 0b00000100) this.localWorld.markDirtyByPos(x, y + 1, z);
            } else surrounded = false;
            if(nz & 0b00100000) {
                if(~(nz & 0b00111111) & 0b00100000) this.localWorld.markDirtyByPos(x, y, z - 1);
            } else surrounded = false;
            if(pz & 0b00100000) {
                if(~(pz & 0b00111111) & 0b00010000) this.localWorld.markDirtyByPos(x, y, z + 1);
            } else surrounded = false;

            if(surrounded) this.localWorld.markChunkDirty(localChunk);            

            loadedChunks.set(rx - 1, ry, rz, nx | 0b00000010);
            loadedChunks.set(rx + 1, ry, rz, px | 0b00000001);
            loadedChunks.set(rx, ry - 1, rz, ny | 0b00001000);
            loadedChunks.set(rx, ry + 1, rz, py | 0b00000100);
            loadedChunks.set(rx, ry, rz - 1, nz | 0b00100000);
            loadedChunks.set(rx, ry, rz + 1, pz | 0b00010000);
        }

        for(let x = -r - 1; x < r + 1; x++) {
            for(let y = -r - 1; y < r + 1; y++) {
                for(let z = -r - 1; z < r + 1; z++) {
                    if(!this.localWorld.blocks.chunkExists(x + centerX, y + centerY, z + centerZ)) continue;

                    loadedChunks.set(x, y, z, 0b01000000);
                }
            }
        }

        let fetchCount = 0;
        for(let x = -r; x < r; x++) {
            for(let y = -r; y < r; y++) {
                for(let z = -r; z < r; z++) {
                    let count = loadedChunks.get(x, y, z);
                    if(loadedChunks.get(x - 1, y, z) & 0b01000000) count |= 0b00000001;
                    if(loadedChunks.get(x + 1, y, z) & 0b01000000) count |= 0b00000010;
                    if(loadedChunks.get(x, y - 1, z) & 0b01000000) count |= 0b00000100;
                    if(loadedChunks.get(x, y + 1, z) & 0b01000000) count |= 0b00001000;
                    if(loadedChunks.get(x, y, z - 1) & 0b01000000) count |= 0b00010000;
                    if(loadedChunks.get(x, y, z + 1) & 0b01000000) count |= 0b00100000;
                    loadedChunks.set(x, y, z, count);

                    if(count & 0b01000000) continue;
                    
                    this.fetchChunk(x + centerX, y + centerY, z + centerZ).then(onFetchResponse);
                    fetchCount++;
                }
            }
        }
        console.log("Fetching " + fetchCount + " chunk(s) from server");
    }
}