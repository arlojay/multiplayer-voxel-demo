import { Box3, Color, Euler, PerspectiveCamera, Ray, Vector3 } from "three";
import { BLOCK_HITBOX, Entity } from "../entity/entity";
import { PlayerController } from "../playerController";
import { dlerp } from "../math";
import { Client, getClient } from "./client";
import { BreakBlockPacket, PlaceBlockPacket } from "../packet";
import { simpleHash } from "./remotePlayer";
import { ClientSounds } from "./clientSounds";
import { CHUNK_INC_SCL } from "../voxelGrid";


export class LocalPlayer extends Entity {
    public static readonly eyeHeightStanding = 1.7;
    public static readonly eyeHeightCrouching = 1.35;
    public static readonly hitboxStanding: Box3 = Object.freeze(new Box3(
        new Vector3(-0.3, 0, -0.3),
        new Vector3(0.3, 1.8, 0.3)
    ));
    public static readonly hitboxCrouching: Box3 = Object.freeze(new Box3(
        new Vector3(-0.3, 0, -0.3),
        new Vector3(0.3, 1.45, 0.3)
    ));

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
    public camera: PerspectiveCamera = new PerspectiveCamera(90, 1, 0.01, 100);
    public crouching: boolean;
    public sprinting: boolean;

    private viewBobTime = 0.0;
    private viewBobIntensity = 0.0;
    private panRoll = 0;
    private pitchOffset = 0;
    private fovMultiplier = 1;
    private fovBase = 90;
    private waitingForChunk = false;
    
    public username = "localplayer";
    public color = "#ff0000";

    public update(dt: number) {
        this.updateControls(dt);

        if(!this.waitingForChunk) super.update(dt);

        if(!this.world.blocks.chunkExists(this.chunkX, this.chunkY, this.chunkZ)) {
            if(!this.waitingForChunk) {
                this.waitingForChunk = true;
                
                // getClient().serverSession.fetchChunk(this.chunkX, this.chunkY, this.chunkZ).then((chunk) => {
                //     const localChunk = this.world.blocks.getChunk(this.chunkX, this.chunkY, this.chunkZ);
                //     localChunk.data.set(chunk.data);

                //     this.world.markChunkDirty(localChunk);

                //     const tryChunkDirty = (x: number, y: number, z: number) => {
                //         const chunk = this.world.blocks.getChunk(x, y, z);
                //         if(chunk == null) return;
                //         this.world.markChunkDirty(chunk);
                //     }
                //     tryChunkDirty(this.chunkX - 1, this.chunkY, this.chunkZ);
                //     tryChunkDirty(this.chunkX + 1, this.chunkY, this.chunkZ);
                //     tryChunkDirty(this.chunkX, this.chunkY - 1, this.chunkZ);
                //     tryChunkDirty(this.chunkX, this.chunkY + 1, this.chunkZ);
                //     tryChunkDirty(this.chunkX, this.chunkY, this.chunkZ - 1);
                //     tryChunkDirty(this.chunkX, this.chunkY, this.chunkZ + 1);

                //     this.waitingForChunk = false;
                // })
            }
            return;
        } else {
            this.waitingForChunk = false;
        }
    }

    private updateControls(dt: number) {
        const client = getClient();
        const receivingControls = this.controller.pointerCurrentlyLocked;
        const controlOptions = client.gameData.clientOptions.controls;

        const onGround = this.airTime < 0.01;

        let dx = 0;
        let dz = 0;
        let speed = 100;
        let maxHorizontalSpeed = 4;
        
        if(!onGround) {
            speed *= 0.2;
        }

        if(receivingControls) {
            if(this.controller.keyDown("shift")) {
                speed *= 1.5;
                maxHorizontalSpeed *= 1.5;
                this.sprinting = true;
            } else {
                this.sprinting = false;
            }

            if(this.controller.keyDown("c")) {
                speed *= 0.5;
                maxHorizontalSpeed *= 0.5;
                this.crouching = true;
            } else {
                this.hitbox.copy(LocalPlayer.hitboxStanding);
                if(this.collisionChecker.isCollidingWithWorld()) {
                    this.hitbox.copy(LocalPlayer.hitboxCrouching);
                } else {
                    this.crouching = false;
                }
            }

            if(!onGround) {
                maxHorizontalSpeed *= 0.5;
            }

            if(this.controller.keyDown("w")) dz--;
            if(this.controller.keyDown("s")) dz++;

            if(this.controller.keyDown("a")) dx--;
            if(this.controller.keyDown("d")) dx++;
        }

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


        if(onGround && receivingControls) {
            if(this.controller.keyDown(" ")) {
                this.velocity.y = 8;
            }
        }


        this.panRoll = dlerp(this.panRoll, 0, dt, 50);
        if(receivingControls) {
            this.yaw += this.controller.pointerMovement.x * controlOptions.mouseSensitivity * (Math.PI / 180);
            this.pitch += this.controller.pointerMovement.y * controlOptions.mouseSensitivity * (Math.PI / 180) * (controlOptions.invertY ? -1 : 1);

            const panRollVelocity = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2) + 2;
            this.panRoll += this.controller.pointerMovement.x * controlOptions.mouseSensitivity / dt * 0.00001 * panRollVelocity;
        }

        if(this.pitch > Math.PI * 0.5) this.pitch = Math.PI * 0.5;
        if(this.pitch < Math.PI * -0.5) this.pitch = Math.PI * -0.5;

        this.controller.resetPointerMovement();

        if(this.crouching) {
            this.hitbox.copy(LocalPlayer.hitboxCrouching);
        } else {
            this.hitbox.copy(LocalPlayer.hitboxStanding);
        }
        this.eyeHeight = dlerp(this.eyeHeight, this.crouching ? LocalPlayer.eyeHeightCrouching : LocalPlayer.eyeHeightStanding, dt, 50);

        let fovm = 1;

        if(this.sprinting) fovm *= 1.1;
        else if(this.crouching) fovm /= 1.3;

        this.fovMultiplier = dlerp(this.fovMultiplier, fovm, dt, 25);

        this.pitchOffset = dlerp(this.pitchOffset, Math.atan(this.velocity.y * 0.03) * 0.2, dt, 25);

        this.camera.position.copy(this.position);
        this.camera.position.y += this.eyeHeight;
        this.camera.fov = this.fovBase * this.fovMultiplier;

        let yaw = -this.yaw;
        let pitch = -this.pitch;
        let roll = 0;

        pitch += this.pitchOffset;

        if(onGround) {
            const velocityXZ = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
            this.viewBobTime += velocityXZ * dt * 2;

            this.viewBobIntensity = dlerp(this.viewBobIntensity, Math.atan(velocityXZ * 0.2) / 10, dt, 10);
        }


        let cameraOffsetX = 0;
        let cameraOffsetY = 0;
        let cameraOffsetZ = 0;

        cameraOffsetX += Math.cos(this.viewBobTime) * this.viewBobIntensity * 0.5;
        cameraOffsetY += (0.5 - Math.abs(Math.sin(this.viewBobTime))) * this.viewBobIntensity;

        this.camera.position.x += Math.sin(this.yaw) * cameraOffsetZ + Math.cos(this.yaw) * cameraOffsetX;
        this.camera.position.y += cameraOffsetY;
        this.camera.position.z -= Math.cos(this.yaw) * cameraOffsetZ - Math.sin(this.yaw) * cameraOffsetX;

        roll += -Math.atan(this.panRoll) * 0.25;
        roll += Math.cos(this.viewBobTime) * this.viewBobIntensity * 0.2;

        this.camera.rotation.set(0, 0, 0);
        this.camera.rotateY(yaw);
        this.camera.rotateX(pitch);
        this.camera.rotateZ(roll);


        if(this.crouching && this.collisionChecker.isCollidingWithWorld(0, 0, -0.01, 0)) {
            if(!this.collisionChecker.isCollidingWithWorld(0, 0, -0.01, this.velocity.z * dt)) {
                this.velocity.z = 0;
            }
            if(!this.collisionChecker.isCollidingWithWorld(0, this.velocity.x * dt, -0.01, 0)) {
                this.velocity.x = 0;
            }
            if(!this.collisionChecker.isCollidingWithWorld(0, this.velocity.x * dt, -0.01, this.velocity.z * dt)) {
                this.velocity.z = 0;
                this.velocity.x = 0;
            }
        }


        this.visionRay = new Ray(
            this.camera.position.clone(),
            new Vector3(0, 0, -1).applyEuler(new Euler(pitch, Math.PI - yaw, roll, "YXZ"))
        );
        this.visionRay.direction.z *= -1;
        const raycastResult = this.world.raycaster.cast(this.visionRay, 10);

        this.placeBlockCooldown -= dt;
        if(this.controller.keyDown("e") && receivingControls) {
            if(this.placeBlockCooldown <= 0) {
                this.placeBlockCooldown = 0.25;
                if(raycastResult.intersected) {
                    this.placeBlock(
                        raycastResult.x + raycastResult.normalX,
                        raycastResult.y + raycastResult.normalY,
                        raycastResult.z + raycastResult.normalZ
                    );
                }
            }
        } else if(this.controller.keyDown("r") && receivingControls) {
            if(this.placeBlockCooldown <= 0) {
                this.placeBlockCooldown = 0.25;
                if(raycastResult.intersected) {
                    this.breakBlock(
                        raycastResult.x,
                        raycastResult.y,
                        raycastResult.z
                    );
                }
            }
        } else {
            this.placeBlockCooldown = 0;
        }
    }

    public respawn() {
        this.position.x = 0;
        this.position.y = 16;
        this.position.z = 0;
        this.velocity.set(0, 0, 0);
    }

    public breakBlock(x: number, y: number, z: number) {
        if(!this.world.blocks.chunkExists(x >> CHUNK_INC_SCL, y >> CHUNK_INC_SCL, z >> CHUNK_INC_SCL)) return;

        this.world.clearColor(x, y, z);

        const packet = new BreakBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;

        // TODO: Make specific to the session the player belongs to
        Client.instance.serverSession.sendPacket(packet);

        ClientSounds.blockBreak().play().then(sound => {
            sound.pitch = Math.random() * 0.2 + 0.4;
        })
    }

    public placeBlock(x: number, y: number, z: number) {
        if(!this.world.blocks.chunkExists(x >> CHUNK_INC_SCL, y >> CHUNK_INC_SCL, z >> CHUNK_INC_SCL)) return;

        const color = new Color(this.color).getHex();

        const hitbox = BLOCK_HITBOX;
        if(this.collisionChecker.collidesWithHitbox(x, y, z, hitbox)) return;

        this.world.setColor(x, y, z, color);

        const packet = new PlaceBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;
        packet.block = this.world.getValueFromColor(color);

        // TODO: Make specific to the session the player belongs to
        Client.instance.serverSession.sendPacket(packet);

        ClientSounds.blockPlace().play().then(sound => {
            sound.pitch = Math.random() * 0.2 + 0.9;
        })
    }
    
    public setController(controller: PlayerController) {
        this.controller = controller;
    }
}