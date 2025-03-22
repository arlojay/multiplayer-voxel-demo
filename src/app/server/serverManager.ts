import Peer, { DataConnection } from "peerjs";
import { createPeer } from "../turn";

export class ServerManager {
    public id: string;
    public peer: Peer;
    private worker: Worker;
    
    constructor(id: string) {
        this.id = id;
    }

    public async start() {
        this.peer = createPeer(this.id);
        console.log("Starting server " + this.id + "...");
        await new Promise<void>((res, rej) => {
            this.peer.once("open", () => res());
            this.peer.once("error", e => rej(e));
        });
        console.log("Server connected to internet");

        console.log("Setting up server worker...");
        await this.setupWorker();
        console.log("Setting up server network listeners");
        this.initListeners();
    }
    private setupWorker() {
        const worker = new Worker(new URL("./thread.ts", import.meta.url));
        this.worker = worker;

        return new Promise<void>((res, rej) => {
            function messageCallback(event: MessageEvent) {
                const name: string = event.data[0];
                const params: string[] = event.data.slice(1);

                if(name == "ready") {
                    cleanupCallbacks();
                    res();
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
        });
        connection.addListener("error", (error) => {
            commandPort.postMessage(["error", error]);
        });
        connection.addListener("open", () => {
            commandPort.postMessage(["open"]);
        });
        
        connection.addListener("data", (data) => {
            dataPort.postMessage(data, { transfer: [ data ] });
        });
        
        commandPort.addEventListener("message", event => {
            const name: string = event.data[0];
            const params: any[] = event.data.slice(1);

            switch(name) {
                case "close":
                    connection.close();
                    break;
            }
        })

        dataPort.addEventListener("message", event => {
            connection.send(event.data);
        })
    }
}