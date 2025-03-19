import Peer, { DataConnection } from "peerjs";
import { EventEmitter } from "stream";

export class Client extends EventEmitter {
    private peer: Peer;
    private serverConnection: DataConnection;
    public connected: boolean;
    
    constructor() {
        super();

        this.peer = new Peer();
    }

    public connect(id: string): Promise<void> {
        return new Promise((res, rej) => {
            this.serverConnection = this.peer.connect(id);
            this.connected = false;

            this.serverConnection.addListener("open", () => {
                this.connected = true;
                res();
            });
            this.serverConnection.addListener("error", (error) => {
                rej(new Error("Cannot connect to peer " + id, error));
            })
        });
    }

    private initConnectionEvents() {
        this.serverConnection.addListener("data", data => {
            
        });
        this.serverConnection.addListener("close", () => {
            this.emit("disconnected");
        })
    }
}