import { Box3, Vector3 } from "three";
import { World } from "../world";
import { CollisionChecker } from "./collisionChecker";

export const GRAVITY = new Vector3(0, -25, 0);
export const ZERO = new Vector3(0);
export const BLOCK_HITBOX = new Box3(
    new Vector3(0, 0, 0),
    new Vector3(1, 1, 1)
);

export class Entity {
    public world: World = null;
    public position = new Vector3;
    public velocity = new Vector3;
    public hitbox: Box3;
    public airTime: number = 0;
    public collisionChecker: CollisionChecker;

    public setWorld(world: World) {
        this.world = world;
        this.collisionChecker = new CollisionChecker(this.hitbox, this.position, world);
    }

    public update(dt: number) {
        if(this.world == null) return;
        
        this.velocity.add(GRAVITY.clone().multiplyScalar(dt));
        this.velocity.lerp(ZERO, 1 - (0.5 ** (dt * 0.1)));

        this.airTime += dt;

        this.moveY(this.velocity.y * dt);
        this.moveX(this.velocity.x * dt);
        this.moveZ(this.velocity.z * dt);
    }

    public moveX(dx: number) {
        this.position.x += dx;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        this.velocity.x = 0;
        if(dx < 0) {
            this.position.x += lastCollision.x + lastCollision.hitbox.max.x - (this.position.x + this.hitbox.min.x);
        } else if(dx > 0) {
            this.position.x += lastCollision.x + lastCollision.hitbox.min.x - (this.position.x + this.hitbox.max.x);
        }
    }
    public moveY(dy: number) {
        this.position.y += dy;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        this.velocity.y = 0;
        if(dy < 0) {
            this.position.y += lastCollision.y + lastCollision.hitbox.max.y - (this.position.y + this.hitbox.min.y);
            this.airTime = 0;
        } else if(dy > 0) {
            this.position.y += lastCollision.y + lastCollision.hitbox.min.y - (this.position.y + this.hitbox.max.y);
        }
    }
    public moveZ(dz: number) {
        this.position.z += dz;
        if(!this.collisionChecker.isCollidingWithWorld()) return;
        const lastCollision = this.collisionChecker.lastBlockCollision;

        this.velocity.z = 0;
        if(dz < 0) {
            this.position.z += lastCollision.z + lastCollision.hitbox.max.z - (this.position.z + this.hitbox.min.z);
        } else if(dz > 0) {
            this.position.z += lastCollision.z + lastCollision.hitbox.min.z - (this.position.z + this.hitbox.max.z);
        }
    }
}