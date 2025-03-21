import { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { GetChunkPacket, Packet } from "../packet/packet";
import { Server } from "./server";
import { ServerClient } from "./serverClient";

interface ServerPeerEvents {
    "getchunk": (packet: GetChunkPacket) => void;
}

export class ServerPeer extends TypedEmitter<ServerPeerEvents> {
    public connection: DataConnection;
    public id: string;
    public server: Server;
    public client: ServerClient;


    constructor(connection: DataConnection, server: Server) {
        super();
        this.connection = connection;
        this.id = connection.peer;
        this.server = server;

        this.client = new ServerClient;
    }

    public handlePacket(packet: Packet) {
        if(packet instanceof GetChunkPacket) {
            this.emit("getchunk", packet);
        }
    }
}