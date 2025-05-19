import { Box3, Vector3 } from "three";
import { BaseEntity } from "./baseEntity";
import { CollisionChecker } from "./collisionChecker";

export const GRAVITY = new Vector3(0, -25, 0);
export const ZERO = new Vector3(0);
export const BLOCK_HITBOX = new Box3(
    new Vector3(0, 0, 0),
    new Vector3(1, 1, 1)
);

export abstract class LocalEntity {
    protected base: BaseEntity<any, this>;
    public airTime: number = 0;
    public collisionChecker: CollisionChecker;

    public constructor(base: typeof this.base) {
        this.base = base;
        this.init();
    }

    protected abstract init(): void;

    public update(dt: number) {
        if(this.base.world == null) return;
        
        this.base.velocity.add(GRAVITY.clone().multiplyScalar(dt));
        this.base.velocity.lerp(ZERO, 1 - (0.5 ** (dt * 0.1)));

        this.airTime += dt;

        this.moveY(this.base.velocity.y * dt);
        this.moveX(this.base.velocity.x * dt);
        this.moveZ(this.base.velocity.z * dt);
    }

    public moveX(dx: number) {
        this.base.position.x += dx;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        this.base.velocity.x = 0;
        if(dx < 0) {
            this.base.position.x += lastCollision.x + lastCollision.hitbox.max.x - (this.base.position.x + this.base.hitbox.min.x);
        } else if(dx > 0) {
            this.base.position.x += lastCollision.x + lastCollision.hitbox.min.x - (this.base.position.x + this.base.hitbox.max.x);
        }
    }
    public moveY(dy: number) {
        this.base.position.y += dy;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        this.base.velocity.y = 0;
        if(dy < 0) {
            this.base.position.y += lastCollision.y + lastCollision.hitbox.max.y - (this.base.position.y + this.base.hitbox.min.y);
            this.airTime = 0;
        } else if(dy > 0) {
            this.base.position.y += lastCollision.y + lastCollision.hitbox.min.y - (this.base.position.y + this.base.hitbox.max.y);
        }
    }
    public moveZ(dz: number) {
        this.base.position.z += dz;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        this.base.velocity.z = 0;
        if(dz < 0) {
            this.base.position.z += lastCollision.z + lastCollision.hitbox.max.z - (this.base.position.z + this.base.hitbox.min.z);
        } else if(dz > 0) {
            this.base.position.z += lastCollision.z + lastCollision.hitbox.min.z - (this.base.position.z + this.base.hitbox.max.z);
        }
    }
}