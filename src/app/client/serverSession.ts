import { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryWriter, U16 } from "../binary";
import { ChunkDataPacket, CombinedPacket, GetChunkPacket, Packet, SetBlockPacket } from "../packet/packet";
import { World } from "../world";
import { Client } from "./client";
import { LocalPlayer } from "./localPlayer";

interface ServerSessionEvents {
    "disconnected": () => void;
}

export class ServerSession extends TypedEmitter<ServerSessionEvents> {
    public client: Client;
    public serverConnection: DataConnection;
    public player: LocalPlayer;
    public localWorld = new World;
    
    private waitingChunks: Map<string, (packet: ChunkDataPacket) => void> = new Map;

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
        this.player.update(dt);

        const renderer = this.client.gameRenderer;
        renderer.camera.position.copy(this.player.position);
    }

    private onConnected() {
        this.player = new LocalPlayer;
        this.player.setWorld(this.localWorld);
        this.player.position.set(0, 10, 0);
    }
}