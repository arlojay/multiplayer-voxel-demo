import { Box3, Vector3 } from "three";
import { World } from "../world";

export class RemoteEntity {
    public position = new Vector3;
    public velocity = new Vector3;
    public hitbox: Box3;
    public world: World = null;
    
    public renderPosition = new Vector3;
    private timeSinceLastUpdate: number;
    
    constructor() {
        this.position = new Vector3;
        this.velocity = new Vector3;
    }

    public setWorld(world: World) {
        this.world = world;
    }

    public resetTimer() {
        this.timeSinceLastUpdate = 0;
    }

    public update(dt: number) {
        this.timeSinceLastUpdate += dt;
        const newPosition = this.position.clone();
        newPosition.add(this.velocity.clone().multiplyScalar(1 - 0.5 ** (this.timeSinceLastUpdate)));

        this.renderPosition.lerp(newPosition, 1 - 0.5 ** (dt * 30));
        if(isNaN(this.renderPosition.x)) {
            this.renderPosition.copy(this.position);
        }
    }
}