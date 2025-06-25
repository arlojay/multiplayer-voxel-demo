import { DataLibrary } from "../datalibrary/dataLibrary";
import { BaseRegistries } from "../synchronization/baseRegistries";
import { EventSubscriber } from "./events";
import { Server } from "./server";

export abstract class ServerPlugin extends EventSubscriber {
    public abstract readonly name: string;
    public server: Server;
    
    public setServer(server: Server) {
        this.server = server;
    }

    public async addContent(registries: BaseRegistries, dataLibrary: DataLibrary) {

    }

    public async close() {

    }
}