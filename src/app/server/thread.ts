import { PeerError } from "peerjs";
import { TypedEmitter } from "tiny-typed-emitter";
import { Server, ServerOptions } from "./server";

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
    public debugPort: MessagePort;
    public errorPort: MessagePort;

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
    let server: Server;
    
    addEventListener("message", event => {
        const name: string = event.data[0];
        const params: any[] = event.data.slice(1);

        if(name == "options") {
            server = new Server(params[0] as ServerOptions);
            (globalThis as any).server = server;
        
            
            const debugChannel = new MessageChannel();
            const debugPort = debugChannel.port1;
            server.setDebugPort(debugPort);
            debugPort.start();
        
            const errorChannel = new MessageChannel();
            const errorPort = errorChannel.port1;
            server.setErrorPort(errorPort);
            errorPort.start();
        
            console.log(server.debugPort, server.errorPort);
        
            postMessage(["ports", debugChannel.port2, errorChannel.port2 ], { transfer: [ debugChannel.port2, errorChannel.port2 ] });

            server.start().then(() => {
                postMessage(["ready"]);
            });
        }
        if(name == "connection") {
            const options = params[0];
            const connection = new MessagePortConnection(options.peer, options.data, options.command);
            options.data.start();
            options.command.start();

            server.handleConnection(connection);
        }
    });

    postMessage(["getoptions"]);
}