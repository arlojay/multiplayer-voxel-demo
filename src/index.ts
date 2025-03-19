import { Client } from "./app/client/client";
import { Server } from "./app/server/server";
import { VoxelVisualizer } from "./app/voxelVisualizer";
import "./style.css";

const canvas = document.querySelector("canvas");
const voxelVisualizer = new VoxelVisualizer(canvas);


await voxelVisualizer.init();

voxelVisualizer.camera.position.set(16, 8, 16);
voxelVisualizer.controls.target.set(0, 8, 0);

const client = new Client();

async function main() {
    try {
        await client.connect("main");
    } catch(e) {
        console.warn(new Error("Cannot connect to main server", { cause: e }));


        // Host server myself
        const server = new Server("main");
    }
}