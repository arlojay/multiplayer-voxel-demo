import { Box3, Vector3 } from "three";
import { CHUNK_SIZE } from "../world/voxelGrid";
import { World } from "../world/world";
import { BaseEntity } from "./baseEntity";
import { CollisionChecker, CollisionDescription } from "./collisionChecker";
import { positionLerp, velocityLerp } from "../math";
import { TimeMetric } from "../client/updateMetric";

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
    public readonly acceleration: Vector3;
    public readonly drag: Vector3;

    public readonly hitbox: Box3;

    private readonly lastPosition = new Vector3();
    private readonly lastVelocity = new Vector3();
    private readonly lastAcceleration = new Vector3();
    private readonly lastDrag = new Vector3();
    private lastMoveTime = -1;

    /** do NOT override */
    public constructor(base: typeof this.base) {
        this.base = base;
        this.position = base.position;
        this.velocity = base.velocity;
        this.acceleration = base.acceleration;
        this.drag = base.drag;
        this.hitbox = base.hitbox;
    }

    public setWorld(world: World) {
        if(world == null) {
            this.collisionChecker = null;
        } else {
            this.collisionChecker = new CollisionChecker(this.hitbox, this.position, world);
        }
    }

    public update(metric: TimeMetric) {
        if(this.base.world == null) return;

        const dt = metric.dt;
        this.airTime += dt;

        const approximateDeltaTimeStep = 0.01;
        const stepResolution = 0.002;

        let cumulativeDeltaTime = 0;
        while(cumulativeDeltaTime < dt) {
            let partialDeltaTime = (approximateDeltaTimeStep * stepResolution) / Math.sqrt(
                (positionLerp(approximateDeltaTimeStep, this.position.x, this.velocity.x, this.acceleration.x, this.drag.x) - this.position.x) ** 2 +
                (positionLerp(approximateDeltaTimeStep, this.position.y, this.velocity.y, this.acceleration.y, this.drag.y) - this.position.y) ** 2 +
                (positionLerp(approximateDeltaTimeStep, this.position.z, this.velocity.z, this.acceleration.z, this.drag.z) - this.position.z) ** 2
            );
            if(cumulativeDeltaTime + partialDeltaTime > dt) partialDeltaTime = dt - cumulativeDeltaTime;

            this.velocity.x = velocityLerp(partialDeltaTime, this.velocity.x, this.acceleration.x, this.drag.x);
            this.velocity.y = velocityLerp(partialDeltaTime, this.velocity.y, this.acceleration.y, this.drag.y);
            this.velocity.z = velocityLerp(partialDeltaTime, this.velocity.z, this.acceleration.z, this.drag.z);

            this.moveY(partialDeltaTime);
            this.moveX(partialDeltaTime, this.stepSize);
            this.moveZ(partialDeltaTime, this.stepSize);

            cumulativeDeltaTime += partialDeltaTime;
        }
        
        if(!this.ignoreGravity) this.acceleration.copy(GRAVITY);
    }

    private tryStep(lastCollision: CollisionDescription, height = 0.6) {
        if(this.airTime > 0) return;

        const stepY = (lastCollision.hitbox.max.y + lastCollision.y) - (this.hitbox.min.y + this.position.y);
        if(stepY <= height) {
            this.position.y += stepY;
            if(!this.collisionChecker.isCollidingWithWorld()) return true;

            this.position.y -= stepY;
        }

        return false;
    }

    public moveX(dt: number, step?: number) {
        this.position.x = positionLerp(dt, this.position.x, this.velocity.x, this.acceleration.x, this.drag.x);
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        if(this.tryStep(lastCollision, step)) return;
        
        if(this.velocity.x < 0) {
            this.position.x += lastCollision.x + (lastCollision.hitbox.max.x + C) - (this.position.x + this.hitbox.min.x);
        } else if(this.velocity.x > 0) {
            this.position.x += lastCollision.x + (lastCollision.hitbox.min.x - C) - (this.position.x + this.hitbox.max.x);
        }
        this.velocity.x = 0;
        this.acceleration.x = 0;
    }
    public moveY(dt: number) {
        this.position.y = positionLerp(dt, this.position.y, this.velocity.y, this.acceleration.y, this.drag.y);
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;
        
        if(this.velocity.y < 0) {
            this.position.y += lastCollision.y + (lastCollision.hitbox.max.y + C) - (this.position.y + this.hitbox.min.y);
            this.airTime = 0;
        } else if(this.velocity.y > 0) {
            this.position.y += lastCollision.y + (lastCollision.hitbox.min.y - C) - (this.position.y + this.hitbox.max.y);
        }

        this.velocity.y = 0;
        this.acceleration.y = 0;
    }
    public moveZ(dt: number, step?: number) {
        this.position.z = positionLerp(dt, this.position.z, this.velocity.z, this.acceleration.z, this.drag.z);
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        if(this.tryStep(lastCollision, step)) return;
        
        if(this.velocity.z < 0) {
            this.position.z += lastCollision.z + (lastCollision.hitbox.max.z + C) - (this.position.z + this.hitbox.min.z);
        } else if(this.velocity.z > 0) {
            this.position.z += lastCollision.z + (lastCollision.hitbox.min.z - C) - (this.position.z + this.hitbox.max.z);
        }
        this.velocity.z = 0;
        this.acceleration.z = 0;
    }

    public hasMovedSince(metric: TimeMetric) {
        if(metric.time == this.lastMoveTime) return true;

        let moved = false;
        if(this.position.clone().sub(this.lastPosition).length() > 0.01 || this.lastMoveTime == -1) {
            this.lastPosition.copy(this.position);
            moved = true;
        }
        if(this.velocity.clone().sub(this.lastVelocity).length() > 0.01 || this.lastMoveTime == -1) {
            this.lastVelocity.copy(this.velocity);
            moved = true;
        }
        if(this.acceleration.clone().sub(this.lastAcceleration).length() > 0.01 || this.lastMoveTime == -1) {
            this.lastAcceleration.copy(this.acceleration);
            moved = true;
        }
        if(this.drag.clone().sub(this.lastDrag).length() > 0.01 || this.lastMoveTime == -1) {
            this.lastDrag.copy(this.drag);
            moved = true;
        }
        if(moved) {
            this.lastMoveTime = metric.time;
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
    public get ax() {
        return this.acceleration.x;
    }
    public get ay() {
        return this.acceleration.y;
    }
    public get az() {
        return this.acceleration.z;
    }
    public get dx() {
        return this.drag.x;
    }
    public get dy() {
        return this.drag.y;
    }
    public get dz() {
        return this.drag.z;
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