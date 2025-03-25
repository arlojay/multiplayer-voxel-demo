import { Box3, Vector3 } from "three";
import { World } from "../world";
import { AIR_BIT } from "../voxelMesher";

export const GRAVITY = new Vector3(0, -9.81, 0);
export const ZERO = new Vector3(0);

export class Entity {
    public world: World = null;
    public position: Vector3;
    public velocity: Vector3;
    public hitbox: Box3;
    public airTime: number = 0;
    private lastBlockCollision = new Vector3;
    
    constructor() {
        this.position = new Vector3;
        this.velocity = new Vector3;
    }

    public setWorld(world: World) {
        this.world = world;
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

    public isCollidingWithWorld() {
        const minX = Math.floor(this.position.x + this.hitbox.min.x);
        const maxX = Math.ceil(this.position.x + this.hitbox.max.x);
        const minY = Math.floor(this.position.y + this.hitbox.min.y);
        const maxY = Math.ceil(this.position.y + this.hitbox.max.y);
        const minZ = Math.floor(this.position.z + this.hitbox.min.z);
        const maxZ = Math.ceil(this.position.z + this.hitbox.max.z);

        for(let x = minX; x <= maxX; x++) {
            for(let y = minY; y <= maxY; y++) {
                for(let z = minZ; z <= maxZ; z++) {
                    if(this.world.getRawValue(x, y, z) & AIR_BIT) {
                        console.log("colliding " + x + ", " + y + ", " + z + " (" + this.world.getRawValue(x, y, z) + ")");
                        this.lastBlockCollision.x = x;
                        this.lastBlockCollision.y = y;
                        this.lastBlockCollision.z = z;
                        return true;
                    }
                }
            }
        }

        return false;
    }

    public moveX(x: number) {
        this.position.x += x;
        if(!this.isCollidingWithWorld()) return;

        const maxX = this.lastBlockCollision.x + 1;
        const minX = this.lastBlockCollision.x;

        this.velocity.x = 0;
        if(x < 0) {
            this.position.x += maxX - (this.position.x + this.hitbox.min.x);
        } else if(x > 0) {
            this.position.x += minX - (this.position.x + this.hitbox.max.x);
        }
    }
    public moveY(dy: number) {
        this.position.y += dy;
        if(!this.isCollidingWithWorld()) return;

        const maxY = this.lastBlockCollision.y + 1;
        const minY = this.lastBlockCollision.y;

        this.velocity.y = 0;
        if(dy < 0) {
            this.position.y += maxY - (this.position.y + this.hitbox.min.y);
            this.airTime = 0;
        } else if(dy > 0) {
            this.position.y += minY - (this.position.y + this.hitbox.max.y);
        }
    }
    public moveZ(dz: number) {
        this.position.z += dz;
        if(!this.isCollidingWithWorld()) return;        

        const maxZ = this.lastBlockCollision.z + 1;
        const minZ = this.lastBlockCollision.z;

        this.velocity.y = 0;
        if(dz < 0) {
            this.position.z += maxZ - (this.position.z + this.hitbox.min.z);
        } else if(dz > 0) {
            this.position.z += minZ - (this.position.z + this.hitbox.max.z);
        }
    }
}