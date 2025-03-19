import { DataConnection } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";

interface ServerPeerEvents {

}

export class ServerPeer extends TypedEmitter<ServerPeerEvents> {
    public connection: DataConnection;


    constructor(connection: DataConnection) {
        super();
        this.connection = connection;

        connection.addListener("data", data => {
            
        });
    }
}