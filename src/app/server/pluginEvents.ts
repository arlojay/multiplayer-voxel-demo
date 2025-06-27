import { BlockFace } from "../block/block";
import { BlockState } from "../block/blockState";
import { TimeMetric } from "../client/updateMetric";
import { Player } from "../entity/impl";
import { World } from "../world/world";
import { EmittedEvent } from "./events";
import { Server } from "./server";
import { ServerPeer } from "./serverPeer";
import { ServerPlayer } from "./serverPlayer";

export enum PluginEvents {
    PEER_JOIN = "playerJoin",
    PEER_LEAVE = "playerLeave",
    PLACE_BLOCK = "placeBlock",
    BREAK_BLOCK = "breakBlock",
    WORLD_CREATE = "worldCreate",
    SERVER_PREINIT = "serverPreinit",
    SERVER_LOADED = "serverLoaded",
    SERVER_TICK = "serverTick",
    FLUSH_PACKET_QUEUE = "flushPacketQueue",
    INTERACT_BLOCK = "interactBlock"
}

abstract class ServerPluginEvent extends EmittedEvent {
    public server: Server;

    constructor(server: Server) {
        super();
        this.server = server;
    }
}
abstract class ServerPluginPeerEvent extends EmittedEvent {
    public server: Server;

    public peer: ServerPeer;
    public world: World;
    public serverPlayer: ServerPlayer;
    public player: Player;

    constructor(server: Server) {
        super();
        this.server = server;
    }
}

export class PeerJoinEvent extends ServerPluginPeerEvent {
    public readonly name = PluginEvents.PEER_JOIN;
    public readonly cancellable = true;
}

export class PeerLeaveEvent extends ServerPluginPeerEvent {
    public readonly name = PluginEvents.PEER_LEAVE;
    public readonly cancellable = false;
}

export class PlaceBlockEvent extends ServerPluginPeerEvent {
    public readonly name = PluginEvents.PLACE_BLOCK;
    public readonly cancellable = true;

    public x: number;
    public y: number;
    public z: number;
    public block: BlockState;
}

export class BreakBlockEvent extends ServerPluginPeerEvent {
    public readonly name = PluginEvents.BREAK_BLOCK;
    public readonly cancellable = true;

    public x: number;
    public y: number;
    public z: number;
}

export class InteractBlockEvent extends ServerPluginPeerEvent {
    public readonly name = PluginEvents.INTERACT_BLOCK;
    public readonly cancellable = true;

    public x: number;
    public y: number;
    public z: number;
    public pointX: number;
    public pointY: number;
    public pointZ: number;
    public face: BlockFace;
    public block: BlockState;
}

export class PeerMoveEvent extends ServerPluginPeerEvent {
    public readonly name = PluginEvents.BREAK_BLOCK;
    public readonly cancellable = true;

    public playerData: Player;
    public x: number;
    public y: number;
    public z: number;

    public vx: number;
    public vy: number;
    public vz: number;

    public yaw: number;
    public pitch: number;
}

export class WorldCreateEvent extends ServerPluginEvent {
    public readonly name = PluginEvents.WORLD_CREATE;
    public readonly cancellable = true;

    public worldName: string;
}

export class ServerPreinitEvent extends ServerPluginEvent {
    public readonly name = PluginEvents.SERVER_PREINIT;
    public readonly cancellable = true;
}

export class ServerLoadedEvent extends ServerPluginEvent {
    public readonly name = PluginEvents.SERVER_LOADED;
    public readonly cancellable = true;
}

export class ServerTickEvent extends ServerPluginEvent {
    public readonly name = PluginEvents.SERVER_TICK;
    public readonly cancellable = false;
    
    public metric: TimeMetric;
}

export class FlushPacketQueueEvent extends ServerPluginEvent {
    public readonly name = PluginEvents.FLUSH_PACKET_QUEUE;
    public readonly cancellable = true;

    public peer: ServerPeer;
}