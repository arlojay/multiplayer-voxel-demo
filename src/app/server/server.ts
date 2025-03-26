import { TypedEmitter } from "tiny-typed-emitter";
import { ServerPeer } from "./severPeer";
import { ChunkDataPacket, Packet, PlayerJoinPacket, PlayerLeavePacket, PlayerMovePacket, SetBlockPacket } from "../packet/packet";
import { World } from "../world";
import { MessagePortConnection } from "./thread";
import { Color } from "three";

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
                    world.setColor(x, y, z, 0x888888, false);
                }
                for(let y = -1; y <= 1; y++) {
                    world.setColor(x, y, z, 0xCC9966, false);
                }
                world.setColor(x, 2, z, 0xBBFF99, false);
            }
        }
    }

    private startLoop() {
        const mainWorld = this.worlds.get("world");
        const color = new Color;
        setInterval(() => {
            for(let i = 0; i < 16; i++) {
                const x = Math.random();
                const y = Math.random();
                const z = Math.random();
                
                color.r = x;
                color.g = y;
                color.b = z;

                mainWorld.setColor(
                    Math.floor(x * 64) - 32,
                    Math.floor(y * 10) + 3,
                    Math.floor(z * 64) - 32,
                    color
                );
            }
            this.flushWorldUpdateQueue();
        }, 1000 / 1);

        setInterval(() => {
            for(const peer of this.peers.values()) {
                peer.flushPacketQueue();
            }
        }, 1000 / 10);
    }

    private flushWorldUpdateQueue() {
        for(const id of this.worlds.keys()) {
            const world = this.worlds.get(id);

            for(const chunk of world.dirtyChunkQueue) {

                
                world.dirtyChunkQueue.delete(chunk);
            }
        }
    }

    public async handleConnection(connection: MessagePortConnection) {
        const peer = new ServerPeer(connection, this);
        peer.client.setWorld(this.worlds.get("world"));

        peer.addListener("getchunk", packet => {
            const chunk = peer.client.world.blocks.getChunk(packet.x, packet.y, packet.z);

            const responsePacket = new ChunkDataPacket;
            responsePacket.x = packet.x;
            responsePacket.y = packet.y;
            responsePacket.z = packet.z;
            responsePacket.data.set(chunk.data);
            
            peer.sendPacket(responsePacket);
        });
        peer.addListener("move", () => {
            const packet = new PlayerMovePacket;
            packet.player = peer.id;
            packet.x = peer.player.position.x;
            packet.y = peer.player.position.y;
            packet.z = peer.player.position.z;
            packet.vx = peer.player.velocity.x;
            packet.vy = peer.player.velocity.y;
            packet.vz = peer.player.velocity.z;
            packet.yaw = peer.player.yaw;
            packet.pitch = peer.player.pitch;

            for(const otherId of this.peers.keys()) {
                if(otherId == peer.id) continue;

                this.peers.get(otherId).sendPacket(packet);
            }
        })

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

        const joinPacket = new PlayerJoinPacket;
        joinPacket.player = peer.id;
        this.broadcastPacket(joinPacket);

        for(const otherId of this.peers.keys()) {
            const joinPacket = new PlayerJoinPacket;
            joinPacket.player = otherId;

            peer.sendPacket(joinPacket);
        }

        this.peers.set(peer.id, peer);
        this.emit("connection", peer);
    }

    public handleDisconnection(peer: ServerPeer, cause: { toString(): string }) {
        console.log("Peer " + peer.id + " disconnected: " + cause.toString());

        this.peers.delete(peer.id);
        
        const leavePacket = new PlayerLeavePacket;
        leavePacket.player = peer.id;
        this.broadcastPacket(leavePacket);
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