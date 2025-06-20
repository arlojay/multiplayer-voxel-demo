import Peer, { DataConnection } from "peerjs";
import { deserializeError } from "serialize-error";
import { createPeer } from "../turn";
import { debugLog } from "../logging";
import { ServerLaunchOptions } from "./server";
import { getTransferableObjects } from "./transferableUtils";

export class ServerPeerError extends Error {

}

export class ServerManager {
    public launchOptions: ServerLaunchOptions;
    public peer: Peer;
    public id: string;
    private worker: Worker;
    private connections: Map<string, DataConnection> = new Map;
    public started: boolean = false;
    
    constructor(serverId: string, launchOptions: ServerLaunchOptions) {
        this.id = serverId;
        this.launchOptions = launchOptions;
    }

    public async start() {
        this.peer = createPeer("server-" + this.id + "-mvd");
        this.launchOptions.peerId = this.id;
        debugLog("Starting server " + this.id + "...");
        await new Promise<void>((res, rej) => {
            this.peer.once("open", () => res());
            this.peer.once("error", e => rej(new ServerPeerError("Error while creating server connection ", { cause: e })));
        });
        debugLog("Server connected to internet");

        debugLog("Setting up server worker...");
        await this.setupWorker();
        debugLog("Setting up server network listeners");
        this.initListeners();
        this.started = true;
    }
    public async close(force = false) {
        for(const connection of this.connections.values()) connection.close();
        this.peer.disconnect();
        this.peer = null;
        this.started = false;

        if(force) this.worker.terminate();
        else await new Promise<void>((res, rej) => {
            const timeout = setTimeout(() => {
                console.warn("Server closing forcibly; 10 second timeout reached");
                this.worker.terminate();
                res();
            }, 10000);

            this.worker.postMessage(["close"]);
            this.worker.addEventListener("message", event => {
                const name: string = event.data[0];
                const params: any[] = event.data.slice(1);

                if(name == "finished") {
                    clearTimeout(timeout);
                    this.worker.terminate();
                    res();
                }
            })
        });

        this.worker = null;
        debugLog("Server closed successfully");
    }
    private setupWorker() {
        const worker = new Worker(new URL("./thread.ts", import.meta.url));
        this.worker = worker;

        return new Promise<void>((res, rej) => {
            const messageCallback = (event: MessageEvent) => {
                const name: string = event.data[0];
                const params: any[] = event.data.slice(1);

                if(name == "ports") {
                    const debugPort = params[0] as MessagePort;
                    const errorPort = params[1] as MessagePort;

                    debugPort.addEventListener("message", event => {
                        debugLog(event.data);
                    })
                    errorPort.addEventListener("message", event => {
                        debugLog(event.data);
                    })
                }
                if(name == "getoptions") {
                    worker.postMessage(["options", this.launchOptions]);
                }
                if(name == "ready") {
                    cleanupCallbacks();
                    res();
                }
                if(name == "crash") {
                    this.worker.terminate();
                    rej(new Error("Server crashed", { cause: deserializeError(params[0]) }));
                }
            }

            function errorCallback(event: ErrorEvent) {
                cleanupCallbacks();
                rej(new Error("Error while setting up server worker", { cause: event }))
            }

            function cleanupCallbacks() {
                worker.removeEventListener("error", errorCallback);
                worker.removeEventListener("message", messageCallback);
            }

            worker.addEventListener("message", messageCallback);
            worker.addEventListener("error", errorCallback);
        })
    }
    
    private initListeners() {
        this.peer.addListener("connection", connection => {
            this.handleConnection(connection);
        });
    }
    
    private async handleConnection(connection: DataConnection) {
        const dataChannel = new MessageChannel();
        const commandChannel = new MessageChannel();
        this.worker.postMessage([
            "connection",
            {
                peer: connection.peer,
                label: connection.label,
                data: dataChannel.port2,
                command: commandChannel.port2,
            }
        ], [ dataChannel.port2, commandChannel.port2 ]);

        const dataPort = dataChannel.port1;
        const commandPort = commandChannel.port1;
        dataPort.start();
        commandPort.start();

        connection.addListener("close", () => {
            commandPort.postMessage(["close"]);
            this.connections.delete(connection.peer);
        });
        connection.addListener("error", (error) => {
            commandPort.postMessage(["error", error]);
            this.connections.delete(connection.peer);
        });
        connection.addListener("open", () => {
            commandPort.postMessage(["open"]);
            this.connections.set(connection.peer, connection);
        });
        
        connection.addListener("data", (data) => {
            dataPort.postMessage(data, { transfer: getTransferableObjects(data) });
        });

        console.log(connection);
        if(connection.open) {
            commandPort.postMessage(["open"]);
        }
        
        commandPort.addEventListener("message", event => {
            const name: string = event.data[0];
            const params: any[] = event.data.slice(1);

            switch(name) {
                case "close":
                    connection.close({ flush: true });
                    this.connections.delete(connection.peer);
                    break;
            }
        })

        dataPort.addEventListener("message", event => {
            connection.send(event.data);
        })
    }
}