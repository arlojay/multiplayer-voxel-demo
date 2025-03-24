import { TypedEmitter } from "tiny-typed-emitter";
import { ServerPeer } from "./severPeer";
import { createPeer } from "../turn";
import { ChunkDataPacket, Packet, SetBlockPacket } from "../packet/packet";
import { World } from "../world";
import { Color } from "three";
import { MessagePortConnection } from "./thread";

interface ServerEvents {
    "connection": (peer: ServerPeer) => void;
}

export class Server extends TypedEmitter<ServerEvents> {
    public worlds: Map<string, World> = new Map;
    public peers: Map<string, ServerPeer> = new Map;

    public async start() {
        this.worlds.set("world", new World(this));
        this.startLoop();

        this.initWorld();

        console.log("Server loaded!");
    }

    private initWorld() {
        const world = this.worlds.get("world");

        for(let x = -32; x < 32; x++) {
            for(let z = -32; z < 32; z++) {
                for(let y = -5; y <= -1; y++) {
                    world.setColor(x, y, z, 0x888888);
                }
                for(let y = -1; y <= 1; y++) {
                    world.setColor(x, y, z, 0xCC9966);
                }
                world.setColor(x, 2, z, 0xBBFF99);
            }
        }
    }

    private startLoop() {
        const mainWorld = this.worlds.get("world");
        setInterval(() => {
            for(let i = 0; i < 1; i++) {
                mainWorld.setColor(
                    Math.floor(Math.random() * 32),
                    Math.floor(Math.random() * 32),
                    Math.floor(Math.random() * 32),
                    Math.round(Math.random() * 0xFFFFFF)
                );
            }
            // this.flushWorldUpdateQueue();
        }, 1000 / 20);

        setInterval(() => {
            for(const peer of this.peers.values()) {
                peer.flushPacketQueue();
            }
        }, 1000 / 10);
    }

    // private flushWorldUpdateQueue() {
    //     for(const id of this.worlds.keys()) {
    //         const world = this.worlds.get(id);

    //         for(const chunk of world.dirtyChunkQueue) {
    //             const packet = 
    //         }
    //     }
    // }

    public async handleConnection(connection: MessagePortConnection) {
        const peer = new ServerPeer(connection, this);
        peer.client.setWorld(this.worlds.get("world"));
        
        this.peers.set(peer.id, peer);

        peer.addListener("getchunk", packet => {
            const chunk = peer.client.world.blocks.getChunk(packet.x, packet.y, packet.z);

            const responsePacket = new ChunkDataPacket;
            responsePacket.x = packet.x;
            responsePacket.y = packet.y;
            responsePacket.z = packet.z;
            responsePacket.data.set(chunk.data);
            
            peer.sendPacket(responsePacket);
        });

        await new Promise<void>((res, rej) => {
            connection.once("open", () => res());
            connection.once("error", e => {
                this.handleDisconnection(peer, e);
                rej(e);
            });
        })

        connection.addListener("data", data => {
            if(data instanceof ArrayBuffer) {
                peer.handlePacket(data);
            }
        });

        this.emit("connection", peer);
    }

    public handleDisconnection(peer: ServerPeer, cause: { toString(): string }) {
        console.log("Peer " + peer.id + " disconnected: " + cause.toString());
    }

    public broadcastPacket(packet: Packet, world?: World, instant: boolean = false) {
        for(const id of this.peers.keys()) {
            const peer = this.peers.get(id);
            if(world == null || peer.client.world == world) {
                peer.sendPacket(packet, instant);
            }
        }
    }



    public updateBlock(world: World, x: number, y: number, z: number) {
        const packet = new SetBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;
        packet.block = world.blocks.get(x, y, z);
        
        this.broadcastPacket(packet, world);
    }
}