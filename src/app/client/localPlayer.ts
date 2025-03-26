import { Box3, Euler, Ray, Vector3 } from "three";
import { BLOCK_HITBOX, Entity } from "../entity/entity";
import { PlayerController } from "../playerController";
import { dlerp } from "../math";
import { Client, getClient } from "./client";
import { PlaceBlockPacket } from "../packet/packet";


export class LocalPlayer extends Entity {
    public hitbox: Box3 = new Box3(
        new Vector3(-0.3, 0, -0.3),
        new Vector3(0.3, 1.8, 0.3)
    );
    public eyeHeight = 1.7;
    private controller: PlayerController;

    public yaw: number = 0;
    public pitch: number = 0;
    public placeBlockCooldown: number;
    public visionRay: Ray;

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


        this.visionRay = new Ray(
            this.position.clone().add(new Vector3(0, this.eyeHeight, 0)),
            new Vector3(0, 0, 1).applyEuler(new Euler(this.pitch, this.yaw, 0, "YXZ"))
        );
        this.visionRay.direction.z *= -1;

        if(this.controller.leftPointer) {
            if(this.placeBlockCooldown <= 0) {
                this.placeBlockCooldown = 0;
                const raycastResult = this.world.raycaster.cast(this.visionRay, 10);

                if(raycastResult.intersected) {
                    this.placeBlock(
                        raycastResult.x + raycastResult.normalX,
                        raycastResult.y + raycastResult.normalY,
                        raycastResult.z + raycastResult.normalZ
                    );
                }
            }
            this.placeBlockCooldown -= dt;
        } else {
            this.placeBlockCooldown = 0;
        }

        super.update(dt);
    }

    public placeBlock(x: number, y: number, z: number) {
        const color = 0xffff00;

        const hitbox = BLOCK_HITBOX;
        if(this.collidesWithHitbox(x, y, z, hitbox)) return;

        this.world.setColor(x, y, z, color);

        const packet = new PlaceBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;
        packet.block = this.world.getValueFromColor(color);

        // TODO: Make specific to the session the player belongs to
        Client.instance.serverSession.sendPacket(packet);
    }
    
    public setController(controller: PlayerController) {
        this.controller = controller;
    }
}