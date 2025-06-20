import { PeerError } from "peerjs";
import { serializeError } from "serialize-error";
import { TypedEmitter } from "tiny-typed-emitter";
import { Server, ServerLaunchOptions } from "./server";
import { getTransferableObjects } from "./transferableUtils";

let server: Server;
let crashMessages: Error[] = new Array;
let crashing = false;

try {
    init().catch(e => {
        serverCrash(e);
    })
} catch(e) {
    serverCrash(e);
}

export function serverCrash(error: Error) {
    crashMessages.push(error);
    console.error(new Error("Server crashed", { cause: error }));

    if(crashing) return;

    crashing = true;
    
    Promise.allSettled([server?.close()]).then(() => {
        for(const crashError of crashMessages) {
            postMessage(["crash", serializeError(crashError)]);
        }
    });
}

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
    public open = false;
    public label: string;

    constructor(peer: string, dataPort: MessagePort, commandPort: MessagePort, label: string) {
        super();

        this.peer = peer;
        
        this.dataPort = dataPort;
        this.commandPort = commandPort;
        this.label = label;

        dataPort.addEventListener("message", (event) => {
            this.emit("data", event.data);
        });
        commandPort.addEventListener("message", (event) => {
            const name: string = event.data[0];
            const params: any[] = event.data.slice(1);

            switch(name) {
                case "open":
                    this.open = true;
                    this.emit("open");
                    break;
                case "close":
                    this.open = false;
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
        if(!this.open) throw new ReferenceError("Cannot send message to closed message port connection");
        this.dataPort.postMessage(data, getTransferableObjects(data));
    }
    public close() {
        this.open = false;
        this.commandPort.postMessage(["close"]);
    }
}

async function init() {
    addEventListener("message", event => {
        const name: string = event.data[0];
        const params: any[] = event.data.slice(1);

        if(name == "options") {
            server = new Server(params[0] as ServerLaunchOptions);
            (globalThis as any).server = server;
        
            
            const debugChannel = new MessageChannel();
            const debugPort = debugChannel.port1;
            server.setDebugPort(debugPort);
            debugPort.start();
        
            const errorChannel = new MessageChannel();
            const errorPort = errorChannel.port1;
            server.setErrorPort(errorPort);
            errorPort.start();
        
            postMessage(["ports", debugChannel.port2, errorChannel.port2 ], { transfer: [ debugChannel.port2, errorChannel.port2 ] });

            server.start()
            .then(() => postMessage(["ready"]));
        }
        if(name == "connection") {
            const options = params[0];
            const connection = new MessagePortConnection(options.peer, options.data, options.command, options.label);
            options.data.start();
            options.command.start();

            try {
                server.handleConnection(connection);
            } catch(e) {
                serverCrash(e);
            }
        }
        if(name == "close") {
            server.close().then(() => {
                postMessage(["finished"]);
            });
        }
    });

    postMessage(["getoptions"]);
}

export function getServer() {
    return server;
}