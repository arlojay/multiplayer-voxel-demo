import { Vector3 } from "three";
import { BaseEntity } from "./baseEntity";

export abstract class RemoteEntity<Subclass extends RemoteEntity<Subclass>> {
    protected base: BaseEntity<Subclass, any, any>;
    public renderPosition = new Vector3;
    private timeSinceLastUpdate: number;

    public constructor(base: typeof this.base) {
        this.base = base;
        this.init();
    }

    protected init() {

    }

    public resetTimer() {
        this.timeSinceLastUpdate = 0;
    }

    public update(dt: number) {
        this.timeSinceLastUpdate += dt;
        const newPosition = this.base.position.clone();
        newPosition.add(this.base.velocity.clone().multiplyScalar(1 - 0.5 ** (this.timeSinceLastUpdate)));

        this.renderPosition.lerp(newPosition, 1 - 0.5 ** (dt * 30));
        if(isNaN(this.renderPosition.x)) {
            this.renderPosition.copy(this.base.position);
        }
    }
}