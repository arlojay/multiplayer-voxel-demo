import { BaseRegistries } from "../baseRegistries";
import { DataLibrary } from "../data/dataLibrary";
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