import { Box3, Ray, Vector3 } from "three";
import { World } from "./world";
import { BLOCK_HITBOX } from "./entity/entity";
import { AIR_BIT } from "./voxelMesher";

interface IntersectionResult {
    intersected: boolean,
    x: number, y: number, z: number,
    block: number,
    hitbox: Box3,
    hitboxX: number, hitboxY: number, hitboxZ: number,
    normalX: number, normalY: number, normalZ: number
}

export class WorldRaycaster {
    public world: World;
    public lastIntersection: IntersectionResult = {
        intersected: false,
        x: 0, y: 0, z: 0,
        block: 0,
        hitbox: BLOCK_HITBOX,
        hitboxX: 0, hitboxY: 0, hitboxZ: 0,
        normalX: 0, normalY: 0, normalZ: 0
    };
    private ray = new Ray;
    private origin = new Vector3;
    private direction = new Vector3;
    private point = new Vector3;
    private intersectionPoint = new Vector3;

    public constructor(world: World) {
        this.world = world
    }

    public intersectingWorld(x: number, y: number, z: number) {
        const hitbox = BLOCK_HITBOX;

        const block = this.world.getRawValue(x, y, z);
        if(block & AIR_BIT) return false;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        if(x < hitbox.min.x) return false;
        if(x > hitbox.max.x) return false;
        if(y < hitbox.min.y) return false;
        if(y > hitbox.max.y) return false;
        if(z < hitbox.min.z) return false;
        if(z > hitbox.max.z) return false;

        return true;
    }

    public cast(ray: Ray, length: number) {
        ray = this.ray.copy(ray);
        const origin = this.origin.copy(ray.origin);
        const direction = this.direction.copy(ray.direction);

        const step = 0.01; // TODO: Fix large step sizes

        let distance = 0;
        let x = 0, y = 0, z = 0;
        let block = 0;
        let hitbox = BLOCK_HITBOX;
        let intersected = false;
        
        const point = this.point;
        const intersectionPoint = this.intersectionPoint;

        let intersectionDistance = 0;
        let minIntersectionDistance = Infinity;


        search:
        while(distance < length && !intersected) {
            point.x = origin.x + direction.x * distance;
            point.y = origin.y + direction.y * distance;
            point.z = origin.z + direction.z * distance;
            
            for(x = Math.floor(point.x); x < Math.ceil(point.x); x++) {
                for(y = Math.floor(point.y); y < Math.ceil(point.y); y++) {
                    for(z = Math.floor(point.z); z < Math.ceil(point.z); z++) {
                        block = this.world.getRawValue(x, y, z);
                        if(!(block & AIR_BIT)) continue;

                        hitbox = BLOCK_HITBOX;
                        ray.origin.set(origin.x - x, origin.y - y, origin.z - z);
                        if(ray.intersectBox(hitbox, intersectionPoint) == null) continue;

                        intersected = true;
                        intersectionDistance = ray.origin.distanceToSquared(intersectionPoint);

                        if(intersectionDistance >= minIntersectionDistance) continue;
                        minIntersectionDistance = intersectionDistance;

                        this.lastIntersection.x = x;
                        this.lastIntersection.y = y;
                        this.lastIntersection.z = z;
                        this.lastIntersection.block = block;
                        this.lastIntersection.hitbox = hitbox;
                        this.lastIntersection.hitboxX = intersectionPoint.x;
                        this.lastIntersection.hitboxY = intersectionPoint.y;
                        this.lastIntersection.hitboxZ = intersectionPoint.z;
                    }
                }
            }

            distance += step;
        }
        
        this.lastIntersection.intersected = intersected;

        const axes = [
            { x: -1, y:  0, z:  0, distance: Math.abs(this.lastIntersection.hitbox.min.x - this.lastIntersection.hitboxX) },
            { x:  1, y:  0, z:  0, distance: Math.abs(this.lastIntersection.hitbox.max.x - this.lastIntersection.hitboxX) },
            { x:  0, y: -1, z:  0, distance: Math.abs(this.lastIntersection.hitbox.min.y - this.lastIntersection.hitboxY) },
            { x:  0, y:  1, z:  0, distance: Math.abs(this.lastIntersection.hitbox.max.y - this.lastIntersection.hitboxY) },
            { x:  0, y:  0, z: -1, distance: Math.abs(this.lastIntersection.hitbox.min.z - this.lastIntersection.hitboxZ) },
            { x:  0, y:  0, z:  1, distance: Math.abs(this.lastIntersection.hitbox.max.z - this.lastIntersection.hitboxZ) }
        ];
        let smallestAxis: typeof axes[0] = null;
        let smallestAxisDistance = Infinity;

        for(const axis of axes) {
            if(axis.distance >= smallestAxisDistance) continue;

            smallestAxis = axis;
            smallestAxisDistance = axis.distance;
        }

        this.lastIntersection.normalX = smallestAxis.x;
        this.lastIntersection.normalY = smallestAxis.y;
        this.lastIntersection.normalZ = smallestAxis.z;

        return this.lastIntersection;
    }
}