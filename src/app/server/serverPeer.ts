import { TypedEmitter } from "tiny-typed-emitter";
import { AddEntityPacket, InteractBlockPacket, BreakBlockPacket, ChangeWorldPacket, ChunkDataPacket, ClientMovePacket, CombinedPacket, EntityMovePacket, GetChunkPacket, KickPacket, Packet, packetRegistry, PingPacket, PingResponsePacket, PlaceBlockPacket, RemoveEntityPacket, splitPacket, SplitPacket, SplitPacketAssembler, InventoryInteractionPacket, UpdateInventoryPacket } from "../packet";
import { EntityLookPacket } from "../packet/entityLookPacket";
import { BinaryBuffer } from "../serialization/binaryBuffer";
import { ClientIdentity } from "../synchronization/serverIdentity";
import { UIContainer } from "../ui";
import { CHUNK_INC_SCL } from "../world/voxelGrid";
import { World } from "../world/world";
import { BreakBlockEvent, InteractBlockEvent, PlaceBlockEvent } from "./pluginEvents";
import { Server } from "./server";
import { ServerPlayer } from "./serverPlayer";
import { ServerUI } from "./serverUI";
import { DataConnectionLike } from "../turn";
import { TimeMetric } from "../client/updateMetric";
import { InventoryInteractionType, StorageInterface } from "../storage/storageInterface";
import { InventoryMap } from "../storage/inventoryMap";
import { Inventory } from "../storage/inventory";
import { StorageLayout } from "../storage/storageLayout";
import { UpdateStorageLayoutPacket } from "../packet/updateStorageLayoutPacket";

interface ServerPeerEvents {
    "chunkrequest": (packet: GetChunkPacket) => void;
    "disconnected": (cause: string) => void;
    "packet": (packet: Packet) => void;
}

export class TimedOutError extends Error {

}

export class ServerPeer extends TypedEmitter<ServerPeerEvents> {
    public connection: DataConnectionLike;
    public connected: boolean = false;
    public id: string;
    public server: Server;
    public serverPlayer: ServerPlayer = null;
    private packetQueue: Set<ArrayBuffer> = new Set;
    private pingPromise: Promise<number> = null;
    public ping: number = 0;
    private onPingResponse: () => void = null;
    private lastPacketReceived: Map<number, number> = new Map;
    private visiblePeers: Set<ServerPeer> = new Set;
    private splitPacketAssembler = new SplitPacketAssembler;
    public authenticated = false;
    public username = "anonymous";
    public color = "ffffff";
    public lastPacketTime = 0;
    public identity: ClientIdentity;
    private storageInterfaces: Map<Inventory, StorageInterface> = new Map;


    constructor(id: string, server: Server) {
        super();
        this.id = id;
        this.server = server;

        this.serverPlayer = new ServerPlayer(this);

        const inventory = this.server.createInventory();
        inventory.setSize(30);
        
        const layout = this.server.createStorageLayout();
        for(let x = 0, i = 0; x < 10; x++) {
            for(let y = 0; y < 3; y++, i++) {
                layout.setSlotPosition(i, x, y);
            }
        }

        this.serverPlayer.base.inventory = inventory;
        this.serverPlayer.base.inventoryLayout = layout;
    }
    public onRealtimeCreated(connection: DataConnectionLike) {
        this.connection = connection;

        connection.addListener("open", () => {
            this.connected = true;
            this.lastPacketTime = this.server.lastMetric.time;
            this.initPingLoop();
        });
        connection.addListener("close", () => {
            if(!this.connected) return;

            this.connected = false;
            this.emit("disconnected", "Connection lost");
        });
        connection.addListener("error", () => {
            this.connected = false;
        });
    }
    private async initPingLoop() {
        try {
            while (this.connected) {
                await this.sendPing();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {
            this.kick("Internal server error");
            throw e;
        }
    }

    private connectionPromise: Promise<void>;
    public waitForConnection() {
        return this.connectionPromise ??= new Promise<void>((res, rej) => {
            this.connection.once("open", () => {
                res();
            });
            this.connection.once("error", e => {
                rej(e);
            });
            this.connection.once("close", () => {
                rej();
            });
        }).then(() => {
            this.connectionPromise = null;
        });
    }

    private isPacketOld(packet: Packet) {
        return this.lastPacketReceived.get(packet.id) > packet.timestamp;
    }

    public handlePacket(data: ArrayBuffer | Packet) {
        if(!this.connected) return;
        this.lastPacketTime = this.server.lastMetric.time;

        let packet = data instanceof Packet ? data : packetRegistry.createFromBinary(data);
        if(data instanceof SplitPacket) {
            data = this.splitPacketAssembler.addPart(data);
            if(data == null) return;
            packet = packetRegistry.createFromBinary(data);
        }

        if(packet instanceof GetChunkPacket) {
            this.server.loadChunk(this.serverPlayer.world, packet.x, packet.y, packet.z).then(chunk => {
                this.sendPacket(new ChunkDataPacket(chunk), true);
            })
        }
        if(packet instanceof ClientMovePacket && !this.isPacketOld(packet)) {
            const success = this.serverPlayer.handleMovement(packet);

            if(success) {
                this.serverPlayer.world.entities.updateEntityLocation(this.serverPlayer.base);
                const broadcastPacket = new CombinedPacket();
                broadcastPacket.addPacket(new EntityMovePacket(this.serverPlayer.base));
                broadcastPacket.addPacket(new EntityLookPacket(this.serverPlayer.base));

                for(const otherPeer of this.server.peers.values()) {
                    if(otherPeer == this) continue;
                    if(otherPeer.serverPlayer.world != this.serverPlayer.world) continue;

                    otherPeer.sendPacket(broadcastPacket, true);
                }
            }
        }
        if(packet instanceof PlaceBlockPacket) {
            const event = new PlaceBlockEvent(this.server);
            event.peer = this;
            event.serverPlayer = this.serverPlayer;
            event.player = this.serverPlayer.base;
            event.world = this.serverPlayer.world;
            event.x = packet.x;
            event.y = packet.y;
            event.z = packet.z;
            event.block = this.server.registries.blocks.createState(packet.block, packet.x, packet.y, packet.z, this.serverPlayer.world);
            this.server.emit(event);

            if(event.isCancelled()) {
                this.updateBlock(packet.x, packet.y, packet.z);
            } else {
                this.server.loadChunk(this.serverPlayer.world, packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL).then(() => {
                    this.serverPlayer.world.setBlockStateKey(packet.x, packet.y, packet.z, packet.block);
                });
            }
        }
        if(packet instanceof BreakBlockPacket) {
            const event = new BreakBlockEvent(this.server);
            event.peer = this;
            event.serverPlayer = this.serverPlayer;
            event.player = this.serverPlayer.base;
            event.world = this.serverPlayer.world;
            event.x = packet.x;
            event.y = packet.y;
            event.z = packet.z;
            this.server.emit(event);

            if(event.isCancelled()) {
                this.updateBlock(packet.x, packet.y, packet.z);
            } else {
                this.server.loadChunk(this.serverPlayer.world, packet.x >> CHUNK_INC_SCL, packet.y >> CHUNK_INC_SCL, packet.z >> CHUNK_INC_SCL).then(() => {
                    this.serverPlayer.world.setBlockStateKey(packet.x, packet.y, packet.z, "air#default");
                });
            }
        }
        if(packet instanceof InteractBlockPacket) {
            const event = new InteractBlockEvent(this.server);
            event.peer = this;
            event.serverPlayer = this.serverPlayer;
            event.player = this.serverPlayer.base;
            event.world = this.serverPlayer.world;
            event.x = packet.x;
            event.y = packet.y;
            event.z = packet.z;
            event.face = packet.face;
            event.pointX = packet.pointX;
            event.pointY = packet.pointY;
            event.pointZ = packet.pointZ;
            event.block = this.serverPlayer.world.getBlockState(packet.x, packet.y, packet.z);
            this.server.emit(event);
        }
        if(packet instanceof PingResponsePacket && !this.isPacketOld(packet)) {
            if(this.onPingResponse != null) this.onPingResponse();
        }
        if(packet instanceof InventoryInteractionPacket) {
            const inventory = this.server.inventoryMap.get(packet.inventoryId);
            console.log(inventory, packet.inventoryId);
            let storageInterface = this.storageInterfaces.get(inventory);
            if(storageInterface == null) {
                storageInterface = inventory.createInterface(this.serverPlayer.base.movingSlot);
                this.storageInterfaces.set(inventory, storageInterface);
            }
            try {
                switch(packet.interactionType) {
                    case InventoryInteractionType.PICK_UP_STACK:
                        storageInterface.pickUpStack(packet.slotIndex);
                        break;
                    case InventoryInteractionType.DROP_STACK:
                        storageInterface.dropStack(packet.slotIndex);
                        break;
                    case InventoryInteractionType.SPLIT_STACK:
                        storageInterface.splitStack(packet.slotIndex);
                        break;
                    case InventoryInteractionType.DROP_ONE:
                        storageInterface.dropOne(packet.slotIndex);
                        break;
                    case InventoryInteractionType.MERGE_STACK:
                        storageInterface.mergeStack(packet.slotIndex);
                        break;
                    case InventoryInteractionType.SWAP_STACK:
                        storageInterface.swapStack(packet.slotIndex);
                        break;
                }
            } catch(e) {
                console.debug(e.message);
                this.updateInventory(inventory);
            }
        }


        this.emit("packet", packet);
        this.lastPacketReceived.set(packet.id, packet.timestamp);
    }

    // TODO: refactor for"add to queue" instead of "send instantly" flag
    public sendPacket(masterPacket: Packet, instant: boolean = false) {
        if(instant) {
            const splitPackets = splitPacket(masterPacket);
            for(const packet of splitPackets) {
                const buffer = packet.allocateBuffer();
                try {
                    packet.write(new BinaryBuffer(buffer));
                } catch (e) {
                    throw new Error("Failed to write packet " + (packet.constructor?.name), { cause: e });
                }

                if(this.connected) {
                    this.connection.send(buffer);
                } else {
                    this.waitForConnection().then(() => {
                        this.connection.send(buffer);
                    }).catch(() => {
                        // oh no... whatever ;p
                    });
                }
            }
        } else {
            const buffer = masterPacket.allocateBuffer();
            try {
                masterPacket.write(new BinaryBuffer(buffer));
            } catch (e) {
                throw new Error("Failed to write packet " + (masterPacket.constructor?.name), { cause: e });
            }
            this.packetQueue.add(buffer);
        }
    }

    public updateInventory(inventory: Inventory) {
        this.sendPacket(new UpdateInventoryPacket(inventory));
    }
    public updateStorageLayout(storageLayout: StorageLayout) {
        this.sendPacket(new UpdateStorageLayoutPacket(storageLayout));
    }

    public updateBlock(x: number, y: number, z: number) {
        this.sendPacket(this.server.createBlockUpdatePacket(this.serverPlayer.world, x, y, z));
    }

    public flushPacketQueue() {
        if(this.packetQueue.size == 0) return;

        const maxAggregateBytes = 0x4000;


        const iterator = this.packetQueue.values();
        let next: IteratorResult<ArrayBuffer, ArrayBuffer> = iterator.next();

        while (this.packetQueue.size > 0) {
            const combinedPacket = new CombinedPacket;

            let byteAggregate = 0;
            while (!next.done) {
                if(byteAggregate + next.value.byteLength > maxAggregateBytes) break;

                byteAggregate += next.value.byteLength;

                combinedPacket.packets.add(next.value);
                this.packetQueue.delete(next.value);

                next = iterator.next();
            }

            if(this.connected) {
                // No benefit from bundling a singular packet
                if(combinedPacket.packets.size == 1) {
                    for(const packet of combinedPacket.packets) this.connection.send(packet);
                    continue;
                }

                this.sendPacket(combinedPacket, true);
            } else {
                this.waitForConnection().then(() => {
                    this.sendPacket(combinedPacket, true);
                });
            }
        }
    }

    public createUISession(ui: UIContainer): ServerUI {
        const uiInstance = new ServerUI(this, ui);
        return uiInstance;
    }

    public async sendPing() {
        this.ping = await (this.pingPromise ??= new Promise<number>((res, rej) => {
            const pingPacket = new PingPacket;
            const t0 = performance.now();

            this.onPingResponse = () => {
                res(performance.now() - t0);
                this.pingPromise = null;
                this.onPingResponse = null;
            };

            this.sendPacket(pingPacket, true);
        }));
    }

    public kick(reason: string = "Unknown reason") {
        if(this.connected) {
            // Ask the client to disconnect
            const packet = new KickPacket();
            packet.reason = reason;
            this.sendPacket(packet, true);

            this.emit("disconnected", reason);
            this.connected = false; // Stop interpreting packets

            setTimeout(() => {
                this.connection.close(); // Force connection closed
            }, 2000);
        } else {
            this.connection.close();
        }
        console.log("Kicked " + this.id + " for: " + reason);
    }

    public update(metric: TimeMetric) {
        this.serverPlayer.update(metric);

        if(!this.connected) return;
        if(this.lastPacketTime + 5 < metric.time) {
            this.kick("Timed out");
        }
    }

    public sendToWorld(world: World) {
        this.serverPlayer.setWorld(world);
        this.sendPacket(new ChangeWorldPacket(world));

        for(const otherPeer of this.server.peers.values()) {
            if(otherPeer.serverPlayer.world == this.serverPlayer.world) {
                this.showPeer(otherPeer);
                otherPeer.showPeer(this);
            } else {
                this.hidePeer(otherPeer);
                otherPeer.hidePeer(this);
            }
        }
    }

    public showPeer(peer: ServerPeer) {
        if(peer == this) return;
        if(this.visiblePeers.has(peer)) return;

        const joinPacket = new AddEntityPacket(peer.serverPlayer.base);
        this.visiblePeers.add(peer);

        this.sendPacket(joinPacket);
    }
    public hidePeer(peer: ServerPeer) {
        if(peer == this) return;
        if(!this.visiblePeers.has(peer)) return;

        const leavePacket = new RemoveEntityPacket(peer.serverPlayer.base);
        this.visiblePeers.delete(peer);

        this.sendPacket(leavePacket);
    }
    public setIdentity(identity: ClientIdentity) {
        identity.color = identity.color.replace(/[^0-9a-f]/g, "");

        this.identity = identity;

        this.username = identity.username;
        this.color = identity.color;

        this.serverPlayer.base.username = identity.username;
        this.serverPlayer.base.color = identity.color;
    }
}