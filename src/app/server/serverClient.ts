import { Entity } from "../entity/entity";
import { ServerPeer } from "./severPeer";

export class ServerClient extends Entity {
    public peer: ServerPeer;
    
    constructor() {
        super();
    }
}