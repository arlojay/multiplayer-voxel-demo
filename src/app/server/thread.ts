import { PeerError } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { Server } from "./server";

init();

interface MessagePortConnectionEvents {
    "open": () => void;
    "close": () => void;
    "error": (error: PeerError<any>) => void;
    "data": (data: any) => void;
}
export class MessagePortConnection extends TypedEmitter<MessagePortConnectionEvents> {
    public peer: string;

    private dataPort: MessagePort;
    private commandPort: MessagePort;

    constructor(peer: string, dataPort: MessagePort, commandPort: MessagePort) {
        super();

        this.peer = peer;
        
        this.dataPort = dataPort;
        this.commandPort = commandPort;

        dataPort.addEventListener("message", (event) => {
            this.emit("data", event.data);
        });
        commandPort.addEventListener("message", (event) => {
            const name: string = event.data[0];
            const params: any[] = event.data.slice(1);

            switch(name) {
                case "open":
                    this.emit("open");
                    break;
                case "close":
                    this.emit("close");
                    break;
                case "error":
                    this.emit("error", params[0] as PeerError<any>);
                    break;
            }
        })

        dataPort.start();
        commandPort.start();
    }

    public send(data: any) {
        this.dataPort.postMessage(data, data instanceof ArrayBuffer ? [data] : []);
    }
    public close() {
        this.commandPort.postMessage(["close"]);
    }
}

async function init() {
    const server = new Server();
    addEventListener("message", event => {
        const name: string = event.data[0];
        const params: any[] = event.data.slice(1);

        if(name == "connection") {
            const options = params[0];
            const connection = new MessagePortConnection(options.peer, options.data, options.command);

            server.handleConnection(connection);
        }
    });

    await server.start();
    postMessage(["ready"]);
}