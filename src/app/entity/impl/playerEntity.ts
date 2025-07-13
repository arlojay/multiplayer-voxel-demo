import { Box3, Euler, PerspectiveCamera, Ray, Scene, Vector3 } from "three";
import { BlockState, BlockStateSaveKey } from "../../block/blockState";
import { capabilities } from "../../capability";
import { Client, getClient } from "../../client/client";
import { ClientSounds } from "../../client/clientSounds";
import { PlayerModel } from "../../client/playerModel";
import { controls } from "../../controls/controlsMap";
import { PlayerController } from "../../controls/playerController";
import { dlerp, iteratedPositionLerp } from "../../math";
import { InteractBlockPacket, BreakBlockPacket, PlaceBlockPacket } from "../../packet";
import { BinaryBuffer, BOOL, VEC3 } from "../../serialization/binaryBuffer";
import { CHUNK_INC_SCL } from "../../world/voxelGrid";
import { BaseEntity, EntityComponent, EntityLogicType, entityRegistry, EntityRotation, RotatingEntity } from "../baseEntity";
import { GRAVITY, LocalEntity } from "../localEntity";
import { RemoteEntity } from "../remoteEntity";
import { TimeMetric } from "../../client/updateMetric";
import { IntersectionResult } from "../../world/worldRaycaster";
import { normalToBlockFace } from "../../block/block";
import { Inventory, StorageSlot } from "../../storage/inventory";
import { getCurrentBaseRegistries } from "../../synchronization/baseRegistries";
import { StorageLayout } from "src/app/storage/storageLayout";

export class PlayerCapabilities implements EntityComponent<PlayerCapabilities> {
    public canFly = false;

    public copy(other: PlayerCapabilities): void {
        this.canFly = other.canFly;
    }

    public serialize(bin: BinaryBuffer): void {
        bin.write_boolean(this.canFly);
    }
    public deserialize(bin: BinaryBuffer): void {
        this.canFly = bin.read_boolean();
    }
    public getExpectedSize(): number {
        return (
            BOOL
        )
    }
}

export class Player extends BaseEntity<RemotePlayer, LocalPlayer> implements RotatingEntity {
    public static readonly id = entityRegistry.register(this);
    public readonly id = Player.id;

    public rotation = new EntityRotation;
    public capabilities = new PlayerCapabilities;

    public username = "anonymous";
    public color = "ffffff";
    public selectedBlock: BlockStateSaveKey = "color#ffffff";
    public movingSlot = new StorageSlot(getCurrentBaseRegistries());
    public inventory: Inventory;
    public inventoryLayout: StorageLayout;

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
        this.capabilities.serialize(bin);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.username = bin.read_string();
        this.color = bin.read_string();
        this.rotation.deserialize(bin);
        this.capabilities.deserialize(bin);
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            BinaryBuffer.stringByteCount(this.username) +
            BinaryBuffer.stringByteCount(this.color) +
            VEC3 +
            VEC3 +
            this.rotation.getExpectedSize() +
            this.capabilities.getExpectedSize()
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
    public breakBlockCooldown: number;
    public interactBlockCooldown: number;
    public visionRay: Ray;
    public playerCamera: PerspectiveCamera = new PerspectiveCamera(90, 1, 0.01, 100);
    public freeCamera: PerspectiveCamera = new PerspectiveCamera(90, 1, 0.01, 100);
    public crouching: boolean;
    public sprinting: boolean;

    public baseSpeedMultiplier = 1;
    public baseJumpHeight = 1.28;
    public stepSize = 0.55;

    private viewBobTime = 0.0;
    private viewBobIntensity = 0.0;
    private panRoll = 0;
    private pitchOffset = 0;
    private fovMultiplier = 1;
    private fovBase = 90;

    private freecamSpeed = 10;
    private pressedFreecam = false;
    private freecam = false;
    private yawFreecam: number = 0;
    private pitchFreecam: number = 0;

    public flying: boolean;
    private lastJumpAttempt = 0;
    private holdingJump = false;


    public model: PlayerModel = new PlayerModel;
    public lookingBlock: BlockState;

    public get camera() {
        return this.freecam ? this.freeCamera : this.playerCamera;
    }

    public update(metric: TimeMetric) {
        this.updateControls(metric);

        if(this.base.world.blocks.chunkExists(this.base.chunkX, this.base.chunkY, this.base.chunkZ)) {
            super.update(metric);
        }
    }

    private updateControls(metric: TimeMetric) {
        const client = getClient();
        
        let receivingControls = (
            this.controller.pointerCurrentlyLocked ||
            !capabilities.REQUEST_POINTER_LOCK
        );

        if(this.controller.gameUIControl.someBlockingUIOpen()) {
            receivingControls = false;
            this.controller.setPointerLocked(false);
        } else {
            if(this.controller.gameUIControl.isNotFocusedOnAnything()) {
                this.controller.setPointerLocked(true);
            }
        }


        const controlOptions = client.gameData.clientOptions.controls;

        const onGround = this.airTime < 0.01;

        let dx = 0;
        let dz = 0;
        let speed = 100 * this.baseSpeedMultiplier;

        const dt = metric.dt;
        
        if(!onGround && !this.flying && !this.freecam) {
            speed *= 0.1; // decreased air control
        }

        let pointerMoveX = this.controller.pointerMovement.x;
        let pointerMoveY = this.controller.pointerMovement.y;
        if(!capabilities.REQUEST_POINTER_LOCK) {
            const scx = this.controller.pointer.x / innerWidth;
            const scy = this.controller.pointer.y / innerHeight;
            if(scx < 0.2) pointerMoveX -= (0.2 - scx) * controlOptions.mouseSensitivity * Math.PI * 100;
            if(scx > 0.8) pointerMoveX += (scx - 0.8) * controlOptions.mouseSensitivity * Math.PI * 100;
            if(scy < 0.2) pointerMoveY -= (0.2 - scy) * controlOptions.mouseSensitivity * Math.PI * 100;
            if(scy > 0.8) pointerMoveY += (scy - 0.8) * controlOptions.mouseSensitivity * Math.PI * 100;
        }
        this.controller.resetPointerMovement();

        if(receivingControls && !this.freecam) {
            if(this.controller.controlDown(controls.RUN)) {
                speed *= 1.5;
                this.sprinting = true;
            } else {
                this.sprinting = false;
            }

            if(this.controller.controlDown(controls.CROUCH) && !this.flying) {
                this.crouching = true;
            } else {
                this.base.hitbox.copy(LocalPlayer.hitboxStanding);
                if(this.collisionChecker.isCollidingWithWorld()) {
                    this.base.hitbox.copy(LocalPlayer.hitboxCrouching);
                } else {
                    this.crouching = false;
                }
            }

            if(this.controller.controlDown(controls.FORWARD)) dz--;
            if(this.controller.controlDown(controls.BACKWARD)) dz++;

            if(this.controller.controlDown(controls.STRAFE_LEFT)) dx--;
            if(this.controller.controlDown(controls.STRAFE_RIGHT)) dx++;
        }
        
        if(this.crouching) {
            this.base.hitbox.copy(LocalPlayer.hitboxCrouching);

            if(!this.flying) {
                speed *= 0.5;
            }
        } else {
            this.base.hitbox.copy(LocalPlayer.hitboxStanding);
        }

        const length = Math.sqrt(dx * dx + dz * dz);
        if(length > 1) {
            dx /= length;
            dz /= length;
        }

        if(this.flying) {
            speed *= 2;
            this.ignoreGravity = true;
        } else {
            this.ignoreGravity = false;
        }

        if(!this.base.capabilities.canFly) {
            this.flying = false;
        }


        this.lastJumpAttempt += dt;
        if(receivingControls && !this.freecam) {
            let flyingYChange = 0;

            if(this.controller.controlDown(controls.JUMP)) {
                if(!this.holdingJump) {
                    if(this.lastJumpAttempt < 0.5 && this.base.capabilities.canFly) {
                        this.flying = !this.flying;
                        this.lastJumpAttempt = 0.5;
                    } else {
                        this.lastJumpAttempt = 0;
                    }
                }
                this.holdingJump = true;

                if(this.flying) {
                    flyingYChange++;
                } else if(onGround) {
                    this.base.velocity.y = Math.sqrt(this.baseJumpHeight * 2 * -GRAVITY.y);
                    this.base.acceleration.y = 0;
                }
            } else {
                this.holdingJump = false;
            }
            if(this.controller.controlDown(controls.CROUCH) && this.flying) {
                flyingYChange--;
            }

            if(this.flying) {
                let change = flyingYChange * speed;
                this.base.acceleration.y = change;
            }
        }

        const zMovement = (Math.cos(this.base.rotation.yaw) * dz + Math.sin(this.base.rotation.yaw) * dx) * speed;
        const xMovement = -(Math.sin(this.base.rotation.yaw) * dz - Math.cos(this.base.rotation.yaw) * dx) * speed;

        this.base.acceleration.x = xMovement;
        this.base.acceleration.z = zMovement;

        if(this.flying) {
            this.drag.set(10, 10, 10);
        } else {
            this.drag.y = 0.25;
            if(onGround) {
                this.drag.x = 20;
                this.drag.z = 20;
            } else {
                this.drag.x = 2;
                this.drag.z = 2;
            }
        }


        this.panRoll = dlerp(this.panRoll, 0, dt, 50);
        if(receivingControls && !this.freecam) {
            this.base.rotation.yaw += pointerMoveX * controlOptions.mouseSensitivity * (Math.PI / 180);
            this.base.rotation.pitch += pointerMoveY * controlOptions.mouseSensitivity * (Math.PI / 180) * (controlOptions.invertY ? -1 : 1);

            const panRollVelocity = Math.sqrt(this.base.velocity.x ** 2 + this.base.velocity.z ** 2) + 2;
            this.panRoll += pointerMoveX * controlOptions.mouseSensitivity / dt * 0.00002 * panRollVelocity;
        }

        if(this.base.rotation.pitch > Math.PI * 0.5) this.base.rotation.pitch = Math.PI * 0.5;
        if(this.base.rotation.pitch < Math.PI * -0.5) this.base.rotation.pitch = Math.PI * -0.5;

        this.eyeHeight = dlerp(this.eyeHeight, this.crouching ? LocalPlayer.eyeHeightCrouching : LocalPlayer.eyeHeightStanding, dt, 1000);

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
            const deltaX = iteratedPositionLerp(dt, this.base.position.x, this.base.velocity.x, this.base.acceleration.x, this.base.drag.x) - this.base.position.x;
            const deltaZ = iteratedPositionLerp(dt, this.base.position.z, this.base.velocity.z, this.base.acceleration.z, this.base.drag.z) - this.base.position.z;
            if(!this.collisionChecker.isCollidingWithWorld(0, 0, -0.01, deltaZ)) {
                this.base.velocity.z = 0;
                this.base.acceleration.z = 0;
            }
            if(!this.collisionChecker.isCollidingWithWorld(0, deltaX, -0.01, 0)) {
                this.base.velocity.x = 0;
                this.base.acceleration.x = 0;
            }
        }


        this.visionRay = new Ray(
            this.playerCamera.position.clone(),
            new Vector3(0, 0, -1).applyEuler(new Euler(pitch, Math.PI - yaw, roll, "YXZ"))
        );
        this.visionRay.direction.z *= -1;
        const raycastResult = this.base.world.raycaster.cast(this.visionRay, 10);

        this.placeBlockCooldown -= dt;
        if(this.controller.controlDown(controls.PLACE_BLOCK) && receivingControls && !this.freecam) {
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
        } else {
            this.placeBlockCooldown = 0;
        }
        
        this.breakBlockCooldown -= dt;
        if(this.controller.controlDown(controls.BREAK_BLOCK) && receivingControls && !this.freecam) {
            if(this.breakBlockCooldown <= 0) {
                this.breakBlockCooldown = 0.25;
                if(raycastResult.intersected) {
                    this.breakBlock(
                        raycastResult.x,
                        raycastResult.y,
                        raycastResult.z
                    );
                }
            }
        } else {
            this.breakBlockCooldown = 0;
        }
        
        this.interactBlockCooldown -= dt;
        if(this.controller.controlDown(controls.INTERACT_BLOCK) && receivingControls && !this.freecam) {
            if(this.interactBlockCooldown <= 0) {
                this.interactBlockCooldown = 0.25;
                if(raycastResult.intersected) {
                    this.interactBlock(raycastResult);
                }
            }
        } else {
            this.interactBlockCooldown = 0;
        }

        if(raycastResult.intersected) {
            this.lookingBlock = this.base.world.getBlockState(raycastResult.x, raycastResult.y, raycastResult.z);
        } else {
            this.lookingBlock = null;
        }

        if(this.controller.controlDown(controls.FREECAM)) {
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
            if(this.controller.controlDown(controls.FORWARD)) dz--;
            if(this.controller.controlDown(controls.BACKWARD)) dz++;
            if(this.controller.controlDown(controls.STRAFE_LEFT)) dx--;
            if(this.controller.controlDown(controls.STRAFE_RIGHT)) dx++;
            if(this.controller.controlDown(controls.FREECAM_DOWN)) dy--;
            if(this.controller.controlDown(controls.FREECAM_UP)) dy++;

            const mult = this.controller.controlDown(controls.RUN) ? 6 : 1;

            const zmove = new Vector3(0, 0, dz * dt * this.freecamSpeed * mult).applyEuler(this.freeCamera.rotation);
            const xmove = new Vector3(dx * dt * this.freecamSpeed * mult, 0, 0).applyEuler(this.freeCamera.rotation);
            const ymove = new Vector3(0, dy * dt * this.freecamSpeed * mult, 0).applyEuler(this.freeCamera.rotation);
            
            if(this.controller.controlDown(controls.JUMP)) this.freeCamera.position.y += dt * mult * this.freecamSpeed;
            if(this.controller.controlDown(controls.CROUCH)) this.freeCamera.position.y -= dt * mult * this.freecamSpeed;

            this.freeCamera.position.add(xmove).add(zmove).add(ymove);
            
            this.yawFreecam += pointerMoveX * controlOptions.mouseSensitivity * (Math.PI / 180);
            this.pitchFreecam += pointerMoveY * controlOptions.mouseSensitivity * (Math.PI / 180) * (controlOptions.invertY ? -1 : 1);

            this.freeCamera.rotation.set(0, 0, 0);
            this.freeCamera.rotateY(-this.yawFreecam);
            this.freeCamera.rotateX(-this.pitchFreecam);
        }

        this.model.mesh.visible = this.freecam;

        this.model.pitch = this.base.rotation.pitch;
        this.model.yaw = this.base.rotation.yaw;
        this.model.position.copy(this.base.position);
        this.model.username = this.base.username;
        this.model.color = this.base.color;
        this.model.update(metric);

        this.controller.resetWheelScrolling();
    }

    public respawn() {
        this.base.position.x = 0;
        this.base.position.y = 16;
        this.base.position.z = 0;
        this.base.velocity.set(0, 0, 0);
        this.base.acceleration.set(0, 0, 0);
    }

    public interactBlock(raycastResult: IntersectionResult) {
        const packet = new InteractBlockPacket;
        packet.face = normalToBlockFace(
            raycastResult.normalX,
            raycastResult.normalY,
            raycastResult.normalZ
        );
        packet.pointX = raycastResult.hitboxX;
        packet.pointY = raycastResult.hitboxY;
        packet.pointZ = raycastResult.hitboxZ;
        packet.x = raycastResult.x;
        packet.y = raycastResult.y;
        packet.z = raycastResult.z;
        Client.instance.serverSession.sendPacket(packet);
    }

    public breakBlock(x: number, y: number, z: number) {
        if(!this.base.world.blocks.chunkExists(x >> CHUNK_INC_SCL, y >> CHUNK_INC_SCL, z >> CHUNK_INC_SCL)) return;

        this.base.world.setBlockStateKey(x, y, z, "air#default");

        const packet = new BreakBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;

        Client.instance.serverSession.sendPacket(packet);

        ClientSounds.blockBreak().play().then(sound => {
            sound.pitch = Math.random() * 0.2 + 0.4;
        })
    }

    public placeBlock(x: number, y: number, z: number) {
        if(!this.base.world.blocks.chunkExists(x >> CHUNK_INC_SCL, y >> CHUNK_INC_SCL, z >> CHUNK_INC_SCL)) return;

        const stateKey = this.base.selectedBlock;
        const block = this.base.world.memoizer.getMemoizedId(stateKey);

        if(this.collisionChecker.collidesWithBlock(x, y, z, block)) return;
        
        if(!this.base.world.memoizer.ignoreRaycasters[this.base.world.memoizer.getMemoizedId(this.base.world.getBlockStateKey(x, y, z))]) return;

        this.base.world.setBlockStateKey(x, y, z, stateKey);

        const packet = new PlaceBlockPacket;
        packet.x = x;
        packet.y = y;
        packet.z = z;
        packet.block = stateKey;

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

    public update(metric: TimeMetric): void {
        super.update(metric);

        this.renderPitch = dlerp(this.renderPitch, this.base.rotation.pitch, metric.dt, 50);
        this.renderYaw = dlerp(this.renderYaw, this.base.rotation.yaw, metric.dt, 50);

        this.model.pitch = this.renderPitch;
        this.model.yaw = this.renderYaw;
        this.model.position.copy(this.renderPosition);
        this.model.username = this.base.username;
        this.model.color = this.base.color;
        this.model.update(metric);
    }

    public onAdd(scene: Scene): void {
        scene.add(this.model.mesh);
    }

    public onRemove(): void {
        this.model.mesh.removeFromParent();
        this.model.dispose();
    }
}