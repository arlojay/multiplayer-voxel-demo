import { Box3, Vector3 } from "three";

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
        const newPosition = this.position.clone();
        newPosition.add(this.velocity.clone().multiplyScalar(1 - 0.5 ** (this.timeSinceLastUpdate)));

        this.renderPosition.lerp(newPosition, 1 - 0.5 ** (dt * 30));
    }
}