import { Entity } from "../entity/entity";
import { ServerPeer } from "./serverPeer";

export class ServerClient extends Entity {
    public peer: ServerPeer;
    
    constructor() {
        super();
    }
}