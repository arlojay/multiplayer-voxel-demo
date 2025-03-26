import { Box3, Vector3 } from "three";
import { World } from "../world";

export class RemoteEntity {
    public position = new Vector3;
    public velocity = new Vector3;
    public hitbox: Box3;
    
    public renderPosition = new Vector3;
    private timeSinceLastUpdate: number;
    
    constructor() {
        this.position = new Vector3;
        this.velocity = new Vector3;
    }

    public resetTimer() {
        this.timeSinceLastUpdate = 0;
    }

    public update(dt: number) {
        this.timeSinceLastUpdate += dt;
        this.renderPosition.copy(this.position);
        this.renderPosition.add(this.velocity.clone().multiplyScalar(this.timeSinceLastUpdate));
    }
}