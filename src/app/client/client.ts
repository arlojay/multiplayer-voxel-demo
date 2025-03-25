import Peer, { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { ChunkDataPacket, CombinedPacket, GetChunkPacket, Packet, SetBlockPacket } from "../packet/packet";
import { createPeer } from "../turn";
import { BinaryWriter } from "../binary";

interface ClientEvents {
    "login": () => void;
    "logout": () => void;
    "disconnected": () => void;

    "getchunk": (x: number, y: number, z: number, data: Uint16Array) => void;
    "setblock": (x: number, y: number, z: number, block: number) => void;
}

export class Client extends TypedEmitter<ClientEvents> {
    private peer: Peer;
    private serverConnection: DataConnection;
    public connected: boolean;

    private waitingChunks: Map<string, (packet: ChunkDataPacket) => void> = new Map;
    
    constructor(id: string) {
        super();

        this.peer = createPeer(id);
        this.peer.addListener("open", () => {
            this.connected = true;
            this.emit("login");
        });
        this.peer.addListener("close", () => {
            this.connected = false;
            this.emit("logout");
        })
    }

    public async waitForLogin() {
        if(this.connected) return;
        console.log("Waiting for internet...");
        await new Promise<void>(r => this.once("login", r));
        console.log("Connected to the internet");
    }

    public async connect(id: string) {
        console.log("Connect to " + id);
        await this.waitForLogin();
        console.log("Connecting to the server " + id);

        const connection = this.peer.connect(id);
        this.serverConnection = connection;

        await new Promise<void>((res, rej) => {
            connection.once("open", () => {
                this.connected = true;
                res();
            });
            connection.once("error", (error) => {
                rej(new Error("Cannot connect to peer " + id, { cause: error }));
            });
            connection.once("close", () => {
                rej(new Error("Cannot connect to peer " + id));
            })
        });

        console.log("Connected to the server " + id + "!");
        this.initConnectionEvents();
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
            this.emit("setblock", packet.x, packet.y, packet.z, packet.block);
        }
        if(packet instanceof ChunkDataPacket) {
            this.emit("getchunk", packet.x, packet.y, packet.z, packet.data);

            const promise = this.waitingChunks.get(packet.x + ";" + packet.y + ";" + packet.z);
            if(promise != null) promise(packet);
        }
    }

    public sendPacket(packet: Packet) {
        const buffer = new ArrayBuffer(packet.getExpectedSize() + 2 /* Packet ID is u16 */ + 1 /* idk this just makes it work */);
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
}