import { Box3, Vector3 } from "three";
import { Entity } from "../entity/entity";
import { PlayerController } from "../playerController";

export class LocalPlayer extends Entity {
    public hitbox: Box3 = new Box3(
        new Vector3(-0.3, 0, -0.3),
        new Vector3(0.3, 1.8, 0.3)
    );
    public eyeHeight = 1.7;
    private controller: PlayerController;

    public yaw: number = Math.PI * 0.25;
    public pitch: number = 0;

    public update(dt: number) {
        let dx = 0;
        let dz = 0;

        if(this.controller.keyDown("w")) dz--;
        if(this.controller.keyDown("s")) dz++;

        if(this.controller.keyDown("a")) dx--;
        if(this.controller.keyDown("d")) dx++;

        if(this.controller.keyDown("j")) this.yaw -= dt;

        this.velocity.z += (Math.cos(this.yaw) * dz - Math.sin(this.yaw) * dx) * dt * 10;
        this.velocity.x += (Math.sin(this.yaw) * dz + Math.cos(this.yaw) * dx) * dt * 10;

        function lerp(a: number, b: number, t: number) {
            return (b - a) * t + a;
        }

        if(this.airTime < 0.01) {
            this.velocity.x = lerp(this.velocity.x, 0, 1 - (0.5 ** (dt * 5)));
            this.velocity.z = lerp(this.velocity.z, 0, 1 - (0.5 ** (dt * 5)));
        }

        super.update(dt);
    }

    public setController(controller: PlayerController) {
        this.controller = controller;
    }
}