import { Box3, Color, Euler, PerspectiveCamera, Ray, Scene, Vector3 } from "three";
import { BinaryBuffer, F32, VEC3 } from "../../binary";
import { BaseEntity, EntityLogicType, entityRegistry, EntityRotation, RotatingEntity } from "../baseEntity";
import { BLOCK_HITBOX, LocalEntity } from "../localEntity";
import { dlerp } from "../../math";
import { BreakBlockPacket, PlaceBlockPacket } from "../../packet";
import { PlayerController } from "../../playerController";
import { CHUNK_INC_SCL } from "../../voxelGrid";
import { Client, getClient } from "../../client/client";
import { ClientSounds } from "../../client/clientSounds";
import { PlayerModel } from "../../client/playerModel";
import { RemoteEntity } from "../remoteEntity";

export class Player extends BaseEntity<RemotePlayer, LocalPlayer> implements RotatingEntity {
    public static readonly id = entityRegistry.register(this);
    public readonly id = Player.id;

    public rotation = new EntityRotation;

    public username = "anonymous";
    public color = "#ffffff";

    constructor(logicType: EntityLogicType) {
        super(logicType);

        this.hitbox.set(
            new Vector3(-0.3, 0, -0.3),
            new Vector3(0.3, 1.8, 0.3)
        )
    }

    protected instanceLogic(local: boolean) {
        return local ? new LocalPlayer(this) : new RemotePlayer(this);
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_string(this.username);
        bin.write_string(this.color);
        this.rotation.serialize(bin);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.username = bin.read_string();
        this.color = bin.read_string();
        this.rotation.deserialize(bin);
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            BinaryBuffer.stringByteCount(this.username) +
            BinaryBuffer.stringByteCount(this.color) +
            VEC3 +
            VEC3 +
            this.rotation.getExpectedSize()
        )
    }
}


export class LocalPlayer extends LocalEntity<Player> {
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
    
    public eyeHeight = 1.7;
    private controller: PlayerController;

    public placeBlockCooldown: number;
    public visionRay: Ray;
    public playerCamera: PerspectiveCamera = new PerspectiveCamera(90, 1, 0.01, 100);
    public freeCamera: PerspectiveCamera = new PerspectiveCamera(90, 1, 0.01, 100);
    public crouching: boolean;
    public sprinting: boolean;

    private viewBobTime = 0.0;
    private viewBobIntensity = 0.0;
    private panRoll = 0;
    private pitchOffset = 0;
    private fovMultiplier = 1;
    private fovBase = 90;
    private waitingForChunk = false;

    private freecamSpeed = 10;
    private pressedFreecam = false;
    private freecam = false;
    private yawFreecam: number = 0;
    private pitchFreecam: number = 0;

    public model: PlayerModel = new PlayerModel;

    public get camera() {
        return this.freecam ? this.freeCamera : this.playerCamera;
    }

    public update(dt: number) {
        this.updateControls(dt);

        if(!this.waitingForChunk) super.update(dt);

        if(!this.base.world.blocks.chunkExists(this.base.chunkX, this.base.chunkY, this.base.chunkZ)) {
            if(!this.waitingForChunk) this.waitingForChunk = true;
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

        if(receivingControls && !this.freecam) {
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
                this.base.hitbox.copy(LocalPlayer.hitboxStanding);
                if(this.collisionChecker.isCollidingWithWorld()) {
                    this.base.hitbox.copy(LocalPlayer.hitboxCrouching);
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

        const zMovement = (Math.cos(this.base.rotation.yaw) * dz + Math.sin(this.base.rotation.yaw) * dx) * dt * speed;
        const xMovement = -(Math.sin(this.base.rotation.yaw) * dz - Math.cos(this.base.rotation.yaw) * dx) * dt * speed;

        const newSpeed = Math.sqrt((this.base.velocity.x + xMovement) ** 2 + (this.base.velocity.z + zMovement) ** 2);        
        const dampFactor = Math.min(1, maxHorizontalSpeed / Math.max(newSpeed));

        this.base.velocity.x += xMovement * dampFactor;
        this.base.velocity.z += zMovement * dampFactor;

        if(onGround) {
            this.base.velocity.x = dlerp(this.base.velocity.x, 0, dt, 25);
            this.base.velocity.z = dlerp(this.base.velocity.z, 0, dt, 25);
        } else {
            this.base.velocity.x = dlerp(this.base.velocity.x, 0, dt, 2);
            this.base.velocity.z = dlerp(this.base.velocity.z, 0, dt, 2);
        }


        if(onGround && receivingControls && !this.freecam) {
            if(this.controller.keyDown(" ")) {
                this.base.velocity.y = 8;
            }
        }


        this.panRoll = dlerp(this.panRoll, 0, dt, 50);
        if(receivingControls && !this.freecam) {
            this.base.rotation.yaw += this.controller.pointerMovement.x * controlOptions.mouseSensitivity * (Math.PI / 180);
            this.base.rotation.pitch += this.controller.pointerMovement.y * controlOptions.mouseSensitivity * (Math.PI / 180) * (controlOptions.invertY ? -1 : 1);

            const panRollVelocity = Math.sqrt(this.base.velocity.x ** 2 + this.base.velocity.z ** 2) + 2;
            this.panRoll += this.controller.pointerMovement.x * controlOptions.mouseSensitivity / dt * 0.00001 * panRollVelocity;
        }

        if(this.base.rotation.pitch > Math.PI * 0.5) this.base.rotation.pitch = Math.PI * 0.5;
        if(this.base.rotation.pitch < Math.PI * -0.5) this.base.rotation.pitch = Math.PI * -0.5;

        if(this.crouching) {
            this.base.hitbox.copy(LocalPlayer.hitboxCrouching);
        } else {
            this.base.hitbox.copy(LocalPlayer.hitboxStanding);
        }
        this.eyeHeight = dlerp(this.eyeHeight, this.crouching ? LocalPlayer.eyeHeightCrouching : LocalPlayer.eyeHeightStanding, dt, 50);

        let fovm = 1;

        if(this.sprinting) fovm *= 1.1;
        else if(this.crouching) fovm /= 1.3;

        this.fovMultiplier = dlerp(this.fovMultiplier, fovm, dt, 25);

        this.pitchOffset = dlerp(this.pitchOffset, Math.atan(this.base.velocity.y * 0.03) * 0.2, dt, 25);

        this.playerCamera.position.copy(this.base.position);
        this.playerCamera.position.y += this.eyeHeight;
        this.playerCamera.fov = this.fovBase * this.fovMultiplier;

        let yaw = -this.base.rotation.yaw;
        let pitch = -this.base.rotation.pitch;
        let roll = 0;

        pitch += this.pitchOffset;

        if(onGround) {
            const velocityXZ = Math.sqrt(this.base.velocity.x ** 2 + this.base.velocity.z ** 2);
            this.viewBobTime += velocityXZ * dt * 2;

            this.viewBobIntensity = dlerp(this.viewBobIntensity, Math.atan(velocityXZ * 0.2) / 10, dt, 10);
        }


        let cameraOffsetX = 0;
        let cameraOffsetY = 0;
        let cameraOffsetZ = 0;

        cameraOffsetX += Math.cos(this.viewBobTime) * this.viewBobIntensity * 0.5;
        cameraOffsetY += (0.5 - Math.abs(Math.sin(this.viewBobTime))) * this.viewBobIntensity;

        this.playerCamera.position.x += Math.sin(this.base.rotation.yaw) * cameraOffsetZ + Math.cos(this.base.rotation.yaw) * cameraOffsetX;
        this.playerCamera.position.y += cameraOffsetY;
        this.playerCamera.position.z -= Math.cos(this.base.rotation.yaw) * cameraOffsetZ - Math.sin(this.base.rotation.yaw) * cameraOffsetX;

        roll += -Math.atan(this.panRoll) * 0.25;
        roll += Math.cos(this.viewBobTime) * this.viewBobIntensity * 0.2;

        this.playerCamera.rotation.set(0, 0, 0);
        this.playerCamera.rotateY(yaw);
        this.playerCamera.rotateX(pitch);
        this.playerCamera.rotateZ(roll);


        if(this.crouching && this.collisionChecker.isCollidingWithWorld(0, 0, -0.01, 0)) {
            if(!this.collisionChecker.isCollidingWithWorld(0, 0, -0.01, this.base.velocity.z * dt)) {
                this.base.velocity.z = 0;
            }
            if(!this.collisionChecker.isCollidingWithWorld(0, this.base.velocity.x * dt, -0.01, 0)) {
                this.base.velocity.x = 0;
            }
            if(!this.collisionChecker.isCollidingWithWorld(0, this.base.velocity.x * dt, -0.01, this.base.velocity.z * dt)) {
                this.base.velocity.z = 0;
                this.base.velocity.x = 0;
            }
        }


        this.visionRay = new Ray(
            this.playerCamera.position.clone(),
            new Vector3(0, 0, -1).applyEuler(new Euler(pitch, Math.PI - yaw, roll, "YXZ"))
        );
        this.visionRay.direction.z *= -1;
        const raycastResult = this.base.world.raycaster.cast(this.visionRay, 10);

        this.placeBlockCooldown -= dt;
        if(this.controller.keyDown("e") && receivingControls && !this.freecam) {
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
        } else if(this.controller.keyDown("r") && receivingControls && !this.freecam) {
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

        if(this.controller.keyDown("u")) {
            if(!this.pressedFreecam) {
                this.pressedFreecam = true;
                this.freecam = !this.freecam;

                if(this.freecam) {
                    this.freeCamera.copy(this.playerCamera);
                }
            }
        } else {
            this.pressedFreecam = false;
        }

        if(this.freecam && receivingControls) {
            let dx = 0;
            let dz = 0;
            let dy = 0;
            if(this.controller.keyDown("w")) dz--;
            if(this.controller.keyDown("s")) dz++;
            if(this.controller.keyDown("a")) dx--;
            if(this.controller.keyDown("d")) dx++;
            if(this.controller.keyDown("q")) dy--;
            if(this.controller.keyDown("e")) dy++;

            const mult = this.controller.keyDown("shift") ? 6 : 1;

            const zmove = new Vector3(0, 0, dz * dt * this.freecamSpeed * mult).applyEuler(this.freeCamera.rotation);
            const xmove = new Vector3(dx * dt * this.freecamSpeed * mult, 0, 0).applyEuler(this.freeCamera.rotation);
            const ymove = new Vector3(0, dy * dt * this.freecamSpeed * mult, 0).applyEuler(this.freeCamera.rotation);
            
            if(this.controller.keyDown(" ")) this.freeCamera.position.y += dt * mult * this.freecamSpeed;
            if(this.controller.keyDown("c")) this.freeCamera.position.y -= dt * mult * this.freecamSpeed;

            this.freeCamera.position.add(xmove).add(zmove).add(ymove);
            
            this.yawFreecam += this.controller.pointerMovement.x * controlOptions.mouseSensitivity * (Math.PI / 180);
            this.pitchFreecam += this.controller.pointerMovement.y * controlOptions.mouseSensitivity * (Math.PI / 180) * (controlOptions.invertY ? -1 : 1);

            this.freeCamera.rotation.set(0, 0, 0);
            this.freeCamera.rotateY(-this.yawFreecam);
            this.freeCamera.rotateX(-this.pitchFreecam);
        }

        this.controller.resetPointerMovement();

        this.model.mesh.visible = this.freecam;

        this.model.pitch = this.base.rotation.pitch;
        this.model.yaw = this.base.rotation.yaw;
        this.model.position.copy(this.base.position);
        this.model.username = this.base.username;
        this.model.color = this.base.color;
        this.model.update(dt);
    }

    public respawn() {
        this.base.position.x = 0;
        this.base.position.y = 16;
        this.base.position.z = 0;
        this.base.velocity.set(0, 0, 0);
    }

    public breakBlock(x: number, y: number, z: number) {
        if(!this.base.world.blocks.chunkExists(x >> CHUNK_INC_SCL, y >> CHUNK_INC_SCL, z >> CHUNK_INC_SCL)) return;

        this.base.world.clearColor(x, y, z);

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
        if(!this.base.world.blocks.chunkExists(x >> CHUNK_INC_SCL, y >> CHUNK_INC_SCL, z >> CHUNK_INC_SCL)) return;

        const color = new Color(this.base.color);

        const hitbox = BLOCK_HITBOX;
        if(this.collisionChecker.collidesWithHitbox(x, y, z, hitbox)) return;

        this.base.world.setColor(x, y, z, color);

        const packet = new PlaceBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;
        packet.block = this.base.world.getValueFromColor(color);

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

export class RemotePlayer extends RemoteEntity<Player> {
    public readonly model = new PlayerModel;

    private renderPitch = 0;
    private renderYaw = 0;

    public get mesh() {
        return this.model.mesh;
    }

    public update(dt: number): void {
        super.update(dt);

        this.renderPitch = dlerp(this.renderPitch, this.base.rotation.pitch, dt, 50);
        this.renderYaw = dlerp(this.renderYaw, this.base.rotation.yaw, dt, 50);

        this.model.pitch = this.renderPitch;
        this.model.yaw = this.renderYaw;
        this.model.position.copy(this.renderPosition);
        this.model.username = this.base.username;
        this.model.color = this.base.color;
        this.model.update(dt);
    }

    public onAdd(scene: Scene): void {
        scene.add(this.model.mesh);
    }

    public onRemove(): void {
        this.model.mesh.removeFromParent();
        this.model.dispose();
    }
}