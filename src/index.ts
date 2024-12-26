import { Camera, Color, Vector3 } from "three";
import { VoxelVisualizer } from "./app/voxelVisualizer";
import "./style.css";
import { ColorType } from "./app/world";
import { workerData } from "worker_threads";

const canvas = document.querySelector("canvas");
const voxelVisualizer = new VoxelVisualizer(canvas);


await voxelVisualizer.init();

voxelVisualizer.camera.position.set(16, 8, 16);
voxelVisualizer.controls.target.set(0, 8, 0);
tree(new Vector3(0, 0, 0), new Vector3(0, 1, 0), 4, {
    color: 0x884400,
    scale: 3,
    primaryFrizz: 0.5,
    childFrizz: 3,
    childCount: 2,

    onBirth: (position, iteration) => {
        if(iteration > 1) return;
        sphere(position.x, position.y, position.z, 2.8, 0x00ff00);
    }
});

interface TreeSettings {
    color: ColorType;
    scale: number;
    primaryFrizz: number;
    childFrizz: number;
    childCount: number;
    onBirth: (position: Vector3, iteration: number) => void;
}
function deviate(vector: Vector3, amount: number): Vector3 {
    const scale = vector.length();
    vector.add(
        new Vector3(
            (Math.random() - 0.5) * amount,
            (Math.random() - 0.5) * amount,
            (Math.random() - 0.5) * amount,
        )
    );
    vector.multiplyScalar(scale / vector.length());
    return vector;
}
function tree(position: Vector3, vector: Vector3, iterations: number, settings: TreeSettings) {
    vector.normalize().multiplyScalar(iterations ** 0.5 * settings.scale);

    line(position, position.clone().add(vector), iterations ** 2 * settings.scale * 0.01, settings.color);
    const end = position.clone().add(vector);
    
    if(iterations <= 0) return;
    tree(
        end,
        deviate(vector.clone(), settings.primaryFrizz * settings.scale),
        iterations - 1, settings
    );
    for(let i = 0; i < settings.childCount; i++) {
        settings.onBirth(end, iterations);
        tree(
            end,
            deviate(vector.clone(), settings.childFrizz * settings.scale),
            iterations - 1, settings
        );
    }
}

function line(positionA: Vector3, positionB: Vector3, diameter: number, color: ColorType) {
    const dist = positionA.distanceTo(positionB);
    const direction = positionB.clone().sub(positionA).normalize();

    const radius = Math.max(1, diameter / 2);
    const radiusSquared = radius ** 2;

    for(let i = 0; i < dist; i++) {
        const x = direction.x * i + positionA.x;
        const y = direction.y * i + positionA.y;
        const z = direction.z * i + positionA.z;

        for(let wx = x - radius; wx <= x + radius; wx++) {
            for(let wy = y - radius; wy <= y + radius; wy++) {
                for(let wz = z - radius; wz <= z + radius; wz++) {
                    const distanceSquared = (wx - x) * (wx - x) + (wy - y) * (wy - y) + (wz - z) * (wz - z);

                    if(distanceSquared < radiusSquared) voxelVisualizer.world.setColor(
                        Math.round(wx), Math.round(wy), Math.round(wz), color
                    );
                }
            }
        }
        
    }
}

function sphere(x: number, y: number, z: number, radius: number, color: ColorType) {
    const radiusSquared = radius ** 2;

    for(let wx = x - radius; wx <= x + radius; wx++) {
        for(let wy = y - radius; wy <= y + radius; wy++) {
            for(let wz = z - radius; wz <= z + radius; wz++) {
                const distanceSquared = (wx - x) * (wx - x) + (wy - y) * (wy - y) + (wz - z) * (wz - z);

                if(distanceSquared > radiusSquared) continue;
                voxelVisualizer.world.setColor(Math.round(wx), Math.round(wy), Math.round(wz), color);
            }
        }
    }
}