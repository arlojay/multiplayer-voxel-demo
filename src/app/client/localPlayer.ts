import { Box3, Vector3 } from "three";
import { Entity } from "../entity/entity";
import { PlayerController } from "../playerController";
import { dlerp, lerp } from "../math";
import { Client, getClient } from "./client";

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
        const client = getClient();
        const onGround = this.airTime < 0.01;


        let dx = 0;
        let dz = 0;
        let speed = 100;
        let maxHorizontalSpeed = 4;
        
        if(!onGround) {
            speed *= 0.2;
        }
        if(this.controller.keyDown("control")) {
            speed *= 1.5;
            maxHorizontalSpeed *= 1.5;
        }
        if(this.controller.keyDown("shift")) {
            speed *= 0.5;
            maxHorizontalSpeed *= 0.5;
        }

        if(this.controller.keyDown("w")) dz--;
        if(this.controller.keyDown("s")) dz++;

        if(this.controller.keyDown("a")) dx--;
        if(this.controller.keyDown("d")) dx++;

        const length = Math.sqrt(dx * dx + dz * dz);
        if(length > 1) {
            dx /= length;
            dz /= length;
        }

        const zMovement = (Math.cos(this.yaw) * dz + Math.sin(this.yaw) * dx) * dt * speed;
        const xMovement = -(Math.sin(this.yaw) * dz - Math.cos(this.yaw) * dx) * dt * speed;

        const newSpeed = Math.sqrt((this.velocity.x + xMovement) ** 2 + (this.velocity.z + zMovement) ** 2);        
        const dampFactor = Math.min(1, maxHorizontalSpeed / Math.max(newSpeed));

        this.velocity.x += xMovement * dampFactor;
        this.velocity.z += zMovement * dampFactor;

        if(onGround) {
            this.velocity.x = dlerp(this.velocity.x, 0, dt, 25);
            this.velocity.z = dlerp(this.velocity.z, 0, dt, 25);
        } else {
            this.velocity.x = dlerp(this.velocity.x, 0, dt, 2);
            this.velocity.z = dlerp(this.velocity.z, 0, dt, 2);
        }


        if(onGround) {
            if(this.controller.keyDown(" ")) {
                this.velocity.y = 8;
            }
        }


        if(this.controller.pointerCurrentlyLocked) {
            this.yaw += this.controller.pointerMovement.x * client.controlOptions.mouseSensitivity * (Math.PI / 180);
            this.pitch += this.controller.pointerMovement.y * client.controlOptions.mouseSensitivity * (Math.PI / 180);

            if(this.pitch > Math.PI * 0.5) this.pitch = Math.PI * 0.5;
            if(this.pitch < Math.PI * -0.5) this.pitch = Math.PI * -0.5;
        }

        this.controller.resetPointerMovement();

        super.update(dt);
    }
    
    public setController(controller: PlayerController) {
        this.controller = controller;
    }
}