import { World } from "../world";
import { EmittedEvent } from "./events";
import { Server } from "./server";
import { ServerPeer } from "./serverPeer";
import { ServerPlayer } from "./serverPlayer";

export enum PluginEvents {
    PLAYER_JOIN = "playerJoin",
    PLAYER_LEAVE = "playerLeave",
    PLACE_BLOCK = "placeBlock",
    BREAK_BLOCK = "breakBlock",
    WORLD_CREATE = "worldCreate",
    SERVER_PREINIT = "serverPreinit",
    SERVER_LOADED = "serverLoaded",
}

abstract class ServerPluginEvent extends EmittedEvent {
    public server: Server;

    constructor(server: Server) {
        super();
        this.server = server;
    }
}
abstract class ServerPluginPlayerEvent extends EmittedEvent {
    public server: Server;

    public peer: ServerPeer;
    public world: World;
    public player: ServerPlayer;

    constructor(server: Server) {
        super();
        this.server = server;
    }
}

export class PlayerJoinEvent extends ServerPluginPlayerEvent {
    public readonly name = PluginEvents.PLAYER_JOIN;
    public readonly cancellable = true;
}

export class PlayerLeaveEvent extends ServerPluginPlayerEvent {
    public readonly name = PluginEvents.PLAYER_LEAVE;
    public readonly cancellable = false;
}

export class PlayerPlaceBlockEvent extends ServerPluginPlayerEvent {
    public readonly name = PluginEvents.PLACE_BLOCK;
    public readonly cancellable = true;

    public x: number;
    public y: number;
    public z: number;
    public block: number;
}

export class PlayerBreakBlockEvent extends ServerPluginPlayerEvent {
    public readonly name = PluginEvents.BREAK_BLOCK;
    public readonly cancellable = true;

    public x: number;
    public y: number;
    public z: number;
}

export class PlayerMoveEvent extends ServerPluginPlayerEvent {
    public readonly name = PluginEvents.BREAK_BLOCK;
    public readonly cancellable = true;

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

    public world: World;
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