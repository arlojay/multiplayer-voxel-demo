import { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryWriter, U16 } from "../binary";
import { ChunkDataPacket, ClientMovePacket, CombinedPacket, GetChunkPacket, Packet, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket } from "../packet/packet";
import { World } from "../world";
import { Client } from "./client";
import { LocalPlayer } from "./localPlayer";
import { Vector3 } from "three";
import { RemotePlayer } from "./remotePlayer";

interface ServerSessionEvents {
    "disconnected": () => void;
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
    
    private waitingChunks: Map<string, (packet: ChunkDataPacket) => void> = new Map;
    private lastUpdateTime: number = 0;

    public constructor(client: Client) {
        super();
        this.client = client;
    }
    
    public async connect(serverId: string) {
        const connection = this.client.peer.connect(serverId);
        this.serverConnection = connection;
        
        await new Promise<void>((res, rej) => {
            connection.once("open", () => res());
            connection.once("error", (error) => {
                rej(new Error("Cannot connect to server " + serverId, { cause: error }));
            });
            connection.once("close", () => {
                rej(new Error("Cannot connect to server " + serverId));
            })
        });

        console.log("Connected to the server " + serverId + "!");
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
            this.emit("disconnected");
        })
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
        if(packet instanceof PlayerMovePacket) {
            const player = this.players.get(packet.player);
            if(player == null) throw new ReferenceError("Player " + packet.player + " does not exist");

            player.position.set(packet.x, packet.y, packet.z);
            player.velocity.set(packet.vx, packet.vy, packet.vz);
            player.yaw = packet.yaw;
            player.pitch = packet.pitch;

            player.resetTimer();
        }
        if(packet instanceof PlayerJoinPacket) {
            const remotePlayer = new RemotePlayer;
            this.players.set(packet.player, remotePlayer);
            console.log("Player " + packet.player + " joined the game");

            this.emit("playerjoin", remotePlayer);
        }
        if(packet instanceof PlayerLeavePacket) {
            const player = this.players.get(packet.player);
            if(player == null) throw new ReferenceError("Player " + packet.player + " does not exist");

            this.emit("playerleave", player);
            this.players.delete(packet.player);
            console.log("Player " + packet.player + " left the game");
        }
    }

    public sendPacket(packet: Packet) {
        const buffer = new ArrayBuffer(packet.getExpectedSize() + U16);
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
        this.lastUpdateTime = time;
        this.player.update(dt);

        const renderer = this.client.gameRenderer;
        renderer.camera.position.copy(this.player.position);
        renderer.camera.position.y += this.player.eyeHeight;

        renderer.camera.rotation.set(0, 0, 0);
        renderer.camera.rotateY(-this.player.yaw);
        renderer.camera.rotateX(-this.player.pitch);




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
}