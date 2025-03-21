import { Vector3 } from "three";
import { World } from "../world";

export const GRAVITY = new Vector3(0, -9.81, 0);
export const ZERO = new Vector3(0);

export class Entity {
    public world: World = null;
    public position: Vector3;
    public velocity: Vector3;
    
    constructor() {
        this.position = new Vector3;
        this.velocity = new Vector3;
    }

    public setWorld(world: World) {
        this.world = world;
    }

    public update(dt: number) {
        this.velocity.add(GRAVITY.clone().addScalar(dt));
        this.position.add(this.velocity.clone().addScalar(dt));

        this.velocity.lerp(ZERO, 1 - (0.5 ** (dt * 0.1)));
    }


}