import { TypedEmitter } from "tiny-typed-emitter";
import { ServerPeer } from "./severPeer";
import { createPeer } from "../turn";
import { Packet, SetBlockPacket } from "../packet/packet";
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

        console.log("Server loaded!");
    }

    private startLoop() {
        const mainWorld = this.worlds.get("world");
        setInterval(() => {
            for(let i = 0; i < 100; i++) {
                mainWorld.setColor(
                    Math.floor(Math.random() * 32),
                    Math.floor(Math.random() * 32),
                    Math.floor(Math.random() * 32),
                    Math.round(Math.random() * 0xFFFFFF)
                );
            }
            // this.flushWorldUpdateQueue();
        }, 1000 / 200);
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

    public broadcastPacket(packet: Packet, world?: World) {
        for(const id of this.peers.keys()) {
            const peer = this.peers.get(id);
            if(world == null || peer.client.world == world) {
                peer.sendPacket(packet);
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