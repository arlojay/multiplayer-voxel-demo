import { Box3, Vector3 } from "three";
import { Entity } from "../entity/entity";

export class LocalPlayer extends Entity {
    public hitbox: Box3 = new Box3(
        new Vector3(-0.3, 0, -0.3),
        new Vector3(0.3, 1.8, 0.3)
    );
}