import { Box3, Vector3 } from "three";
import { CHUNK_SIZE } from "../world/voxelGrid";
import { World } from "../world/world";
import { BaseEntity } from "./baseEntity";
import { CollisionChecker, CollisionDescription } from "./collisionChecker";

export const GRAVITY = new Vector3(0, -25, 0);
export const ZERO = new Vector3(0);

const C = new Float32Array(new Uint8Array([0, 0, 0, 40]).buffer)[0];

export abstract class LocalEntity<Base extends BaseEntity = BaseEntity<any, LocalEntity<any>>> {
    protected readonly base: Base;
    public airTime: number = 0;
    public stepSize = 0.6;
    public collisionChecker: CollisionChecker;
    protected ignoreGravity = false;

    public readonly position: Vector3;
    public readonly velocity: Vector3;
    public readonly hitbox: Box3;

    private readonly lastPosition = new Vector3();
    private readonly lastVelocity = new Vector3();
    private lastMoveTime = -1;

    /** do NOT override */
    public constructor(base: typeof this.base) {
        this.base = base;
        this.position = base.position;
        this.velocity = base.velocity;
        this.hitbox = base.hitbox;
    }

    public setWorld(world: World) {
        if(world == null) {
            this.collisionChecker = null;
        } else {
            this.collisionChecker = new CollisionChecker(this.hitbox, this.position, world);
        }
    }

    public update(dt: number) {
        if(this.base.world == null) return;
        
        if(!this.ignoreGravity) this.base.velocity.add(GRAVITY.clone().multiplyScalar(dt));
        this.base.velocity.lerp(ZERO, 1 - (0.5 ** (dt * 0.1)));

        this.airTime += dt;

        this.moveY(this.base.velocity.y * dt);
        this.moveX(this.base.velocity.x * dt, this.stepSize);
        this.moveZ(this.base.velocity.z * dt, this.stepSize);
    }

    private tryStep(lastCollision: CollisionDescription, height = 0.6) {
        if(this.airTime > 0) return;

        const stepY = (lastCollision.hitbox.max.y + lastCollision.y) - (this.hitbox.min.y + this.base.position.y);
        if(stepY <= height) {
            this.base.position.y += stepY;
            if(!this.collisionChecker.isCollidingWithWorld()) return true;

            this.base.position.y -= stepY;
        }

        return false;
    }

    public moveX(dx: number, step?: number) {
        this.base.position.x += dx;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        if(this.tryStep(lastCollision, step)) return;

        this.base.velocity.x = 0;
        if(dx < 0) {
            this.base.position.x += lastCollision.x + (lastCollision.hitbox.max.x + C) - (this.base.position.x + this.base.hitbox.min.x);
        } else if(dx > 0) {
            this.base.position.x += lastCollision.x + (lastCollision.hitbox.min.x - C) - (this.base.position.x + this.base.hitbox.max.x);
        }
    }
    public moveY(dy: number) {
        this.base.position.y += dy;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        this.base.velocity.y = 0;
        if(dy < 0) {
            this.base.position.y += lastCollision.y + (lastCollision.hitbox.max.y + C) - (this.base.position.y + this.base.hitbox.min.y);
            this.airTime = 0;
        } else if(dy > 0) {
            this.base.position.y += lastCollision.y + (lastCollision.hitbox.min.y - C) - (this.base.position.y + this.base.hitbox.max.y);
        }
    }
    public moveZ(dz: number, step?: number) {
        this.base.position.z += dz;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;
        
        if(this.tryStep(lastCollision, step)) return;

        this.base.velocity.z = 0;
        if(dz < 0) {
            this.base.position.z += lastCollision.z + (lastCollision.hitbox.max.z + C) - (this.base.position.z + this.base.hitbox.min.z);
        } else if(dz > 0) {
            this.base.position.z += lastCollision.z + (lastCollision.hitbox.min.z - C) - (this.base.position.z + this.base.hitbox.max.z);
        }
    }

    public hasMovedSince(time: number) {
        if(time == this.lastMoveTime) return true;

        let moved = false;
        if(this.position.clone().sub(this.lastPosition).length() > 0.01 || this.lastMoveTime == -1) {
            this.lastPosition.copy(this.position);
            moved = true;
        }
        if(this.velocity.clone().sub(this.lastVelocity).length() > 0.01 || this.lastMoveTime == -1) {
            this.lastVelocity.copy(this.velocity);
            moved = true;
        }
        if(moved) {
            this.lastMoveTime = time;
        } else {
            this.lastMoveTime = 0;
        }
        return moved;
    }

    public get x() {
        return this.position.x;
    }
    public get y() {
        return this.position.y;
    }
    public get z() {
        return this.position.z;
    }
    public get vx() {
        return this.velocity.x;
    }
    public get vy() {
        return this.velocity.y;
    }
    public get vz() {
        return this.velocity.z;
    }
    
    public get chunkX() {
        return Math.floor(this.position.x / CHUNK_SIZE);
    }
    public get chunkY() {
        return Math.floor(this.position.y / CHUNK_SIZE);
    }
    public get chunkZ() {
        return Math.floor(this.position.z / CHUNK_SIZE);
    }
}