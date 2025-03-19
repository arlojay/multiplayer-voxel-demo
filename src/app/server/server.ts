import Peer, { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { ServerPeer } from "./severPeer";

interface ServerEvents {
    "connection": (peer: ServerPeer) => void;
}

export class Server extends TypedEmitter<ServerEvents> {
    public peer: Peer;
    public id: string;

    constructor(id: string) {
        super();
        this.id = id;

        this.initListeners();
    }

    private initListeners() {
        this.peer.addListener("connection", connection => {
            this.handleConnection(connection);
        });
    }

    private handleConnection(connection: DataConnection) {
        connection.addListener("data", data => {

        });

        const peer = new ServerPeer(connection);
        this.emit("connection", peer);
    }
}