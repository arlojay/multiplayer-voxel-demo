import { Texture } from "three";

export interface IndexedPackingObject<T> {
    id: number;
    width: number;
    height: number;

    object: T
}
interface PlacedObject<T> {
    left: number;
    right: number;
    top: number;
    bottom: number;

    object: IndexedPackingObject<T>;
}
interface SkylineObject<T> {
    left: number;
    right: number;
    bottom: number;

    placedObject: PlacedObject<T>;
}

export class SkylinePackedAtlas<T = Texture> {
    public readonly sizeX: number;
    public readonly sizeY: number;
    public readonly placedObjects: PlacedObject<T>[] = new Array;
    public readonly placedObjectMap: Map<T, PlacedObject<T>> = new Map;
    public readonly placedObjectIdMap: Map<number, PlacedObject<T>> = new Map;
    private skyline: SkylineObject<T>[] = new Array;

    constructor(sizeX: number, sizeY: number) {
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.skyline.push({
            bottom: 0,
            left: 0,
            right: sizeX,
            placedObject: {
                bottom: 0,
                left: 0,
                right: sizeX,
                top: 0,
                object: {
                    width: sizeX,
                    height: 0,
                    id: -1,
                    object: null
                }
            }
        });
    }

    public getObjectIndex(object: T) {
        const placedObject = this.placedObjectMap.get(object);
        if(placedObject == null) return -1;

        return placedObject.object.id;
    }
    public getPlacedObjectById(id: number) {
        return this.placedObjectIdMap.get(id);
    }

    private addSkylineObject(placedObject: PlacedObject<T>) {
        let skylineObject: SkylineObject<T>;

        const newSkyline: SkylineObject<T>[] = new Array;

        for(let i = 0; i < this.skyline.length; i++) {
            skylineObject = this.skyline[i];

            // Added object is too far left or right to affect current skyline object
            if(
                placedObject.right <= skylineObject.left ||
                placedObject.left >= skylineObject.right
            ) {
                newSkyline.push(skylineObject);
                continue;
            }

            // Added object fully shadows current skyline object
            if(
                placedObject.left <= skylineObject.left &&
                placedObject.right >= skylineObject.right
            ) {
                continue;
            }

            // Added object shadows the right side of the current skyline object, but left is still exposed
            if(
                placedObject.right >= skylineObject.right &&
                placedObject.left > skylineObject.left &&

                placedObject.left < skylineObject.right // make sure it's still overlapping
            ) {
                newSkyline.push({
                    placedObject: skylineObject.placedObject,
                    bottom: skylineObject.bottom,
                    left: skylineObject.left,
                    right: placedObject.left
                });
                continue;
            }

            // Added object shadows the left side of the current skyline object, but right is still exposed
            if(
                placedObject.left <= skylineObject.left &&
                placedObject.right < skylineObject.right &&
                
                placedObject.right > skylineObject.left // make sure it's still overlapping
            ) {
                newSkyline.push({
                    placedObject: skylineObject.placedObject,
                    bottom: skylineObject.bottom,
                    left: placedObject.right,
                    right: skylineObject.right
                });
                continue;
            }

            console.warn("Edge case detected", skylineObject, placedObject);
        }

        newSkyline.push({
            placedObject: placedObject,
            bottom: placedObject.bottom,
            left: placedObject.left,
            right: placedObject.right
        });

        this.skyline = newSkyline.sort((a, b) => a.left - b.left);
    }

    private objectsOverlap(a: PlacedObject<T>, b: PlacedObject<T>) {
        if(a.left >= b.right) return false;
        if(a.right <= b.left) return false;
        if(a.top >= b.bottom) return false;
        if(a.bottom <= b.top) return false;

        return true;
    }

    private collidesWithAny(placedObject: PlacedObject<T>) {
        for(const otherObject of this.placedObjects) {
            if(this.objectsOverlap(placedObject, otherObject)) return true;
        }
        return false;
    }
    private getWastedSpace(placedObject: PlacedObject<T>) {
        let space = 0;
        for(const skylineObject of this.skyline) {
            if(
                placedObject.left > skylineObject.right ||
                placedObject.right < skylineObject.left
            ) continue;

            if(placedObject.left > skylineObject.left) {
                space += (skylineObject.left - placedObject.left) * (placedObject.top - skylineObject.bottom);
            }
            if(placedObject.right < skylineObject.right) {
                space += (placedObject.right - skylineObject.right) * (placedObject.top - skylineObject.bottom);
            }
        }
        return space;
    }

    public tryPlace(object: IndexedPackingObject<T>) {
        if(object.height > this.sizeY) throw new RangeError("Object too tall for atlas");
        if(object.width > this.sizeX) throw new RangeError("Object too wide for atlas");

        if(this.skyline.length == 0) {
            const placedObject = { left: 0, top: 0, right: object.width, bottom: object.height, object };
            this.placedObjects.push(placedObject);
            this.placedObjectMap.set(placedObject.object.object, placedObject);
            this.placedObjectIdMap.set(placedObject.object.id, placedObject);
            this.addSkylineObject(placedObject);
            return;
        }

        let lowestWastedSpace = Infinity;
        let bestPlacement: PlacedObject<T> = null;
        const lowestSkylinePosition = this.skyline.reduce((a, b) => Math.min(a, b.bottom), Infinity);

        for(const skylineObject of this.skyline) {
            const placedObject = {
                left: skylineObject.left,
                right: skylineObject.left + object.width,
                top: skylineObject.bottom,
                bottom: skylineObject.bottom + object.height,
                object
            };

            if(placedObject.right > this.sizeX || placedObject.bottom > this.sizeY) continue;

            if(!this.collidesWithAny(placedObject)) {
                const wastedSpace = this.getWastedSpace(placedObject) + (placedObject.top - lowestSkylinePosition) * 1000;

                if(wastedSpace < lowestWastedSpace) {
                    lowestWastedSpace = wastedSpace;
                    bestPlacement = placedObject;
                }
            }
        }

        if(bestPlacement == null) throw new ReferenceError("No valid non-colliding skyline placement found");
        if(bestPlacement.bottom > this.sizeY) throw new RangeError("Could not find fitting skyline placement within size constraints");

        
        this.placedObjects.push(bestPlacement);
        this.placedObjectMap.set(bestPlacement.object.object, bestPlacement);
        this.placedObjectIdMap.set(bestPlacement.object.id, bestPlacement);
        this.addSkylineObject(bestPlacement);
    }
}