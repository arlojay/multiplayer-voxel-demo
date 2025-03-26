import { Client } from "./app/client/client";
import { ServerManager } from "./app/server/serverManager";
import "./style.css";

const canvas = document.querySelector("canvas");


main();

async function main() {
    const clientId = "client-" + Math.random().toString().slice(2) + "-mvd";
    const serverId = "server-" + Math.random().toString().slice(2) + "-mvd";

    const client = new Client(canvas);
    await client.init();
    (window as any).client = client;
    
    if("navigator" in window && "keyboard" in window.navigator) {
        (window.navigator as any).keyboard.lock([
            "KeyW", "KeyA", "KeyS", "KeyD"
        ]).then(() => {
            console.log("Locked keyboard events!");
        });
    } else {
        console.log("Keyboard locking unsupported");
    }

    document.addEventListener("keydown", e => {
        if(e.key == "F4") {
            if(document.fullscreenElement == canvas) {
                document.exitFullscreen();
            } else {
                canvas.requestFullscreen();
            }
        }
    });
    

    await client.login(clientId);
    
    // Host server myself
    try {
        const server = new ServerManager(serverId);
        await server.start();
    } catch(e) {
        console.warn(new Error("Cannot start server " + serverId, { cause: e }));
    }


    const serverSession = await client.connect(serverId);
    

    for(let x = -3; x < 3; x++) {
        for(let y = -3; y < 3; y++) {
            for(let z = -3; z < 3; z++) {
                serverSession.fetchChunk(x, y, z).then(response => {
                    const localChunk = serverSession.localWorld.blocks.getChunk(x, y, z);
                    localChunk.data.set(response.data);

                    serverSession.localWorld.markChunkDirty(localChunk);
                    serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x + 1, y, z));
                    serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x - 1, y, z));
                    serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x, y + 1, z));
                    serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x, y - 1, z));
                    serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x, y, z + 1));
                    serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x, y, z - 1));
                });
            }
        }
    }
}