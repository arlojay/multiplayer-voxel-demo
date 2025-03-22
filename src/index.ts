import { Client } from "./app/client/client";
import { ServerManager } from "./app/server/serverManager";
import { VoxelVisualizer } from "./app/voxelVisualizer";
import "./style.css";

const canvas = document.querySelector("canvas");
const voxelVisualizer = new VoxelVisualizer(canvas);


await voxelVisualizer.init();

voxelVisualizer.camera.position.set(16, 8, 16);
voxelVisualizer.controls.target.set(0, 8, 0);

main();

async function main() {
    const client = new Client("client-" + Math.random().toString().slice(2) + "-mvd");

    client.addListener("setblock", (x, y, z, block) => {
        voxelVisualizer.world.setColor(x, y, z, block);
    });
    
    // Host server myself
    try {
        const server = new ServerManager("main");
        await server.start();
    } catch(e) {
        console.warn(new Error("Cannot start main server", { cause: e }));
    }
    await client.connect("main");
}