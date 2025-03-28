import { Client } from "./app/client/client";
import { ServerManager } from "./app/server/serverManager";
import "./style.css";

const gameRoot = document.querySelector("#game") as HTMLElement;


main();

async function main() {
    const clientId = "client-" + Math.random().toString().slice(2) + "-mvd";
    // const serverId = "server-" + Math.random().toString().slice(2) + "-mvd";

    const client = new Client(gameRoot);
    await client.init();
    (window as any).client = client;
    
    if("navigator" in window && "keyboard" in window.navigator) {
        (window.navigator as any).keyboard.lock([
            "KeyW", "KeyA", "KeyS", "KeyD", "Space"
        ]).then(() => {
            console.log("Locked keyboard events!");
        }).catch((e: any) => {
            console.warn(e);
        });
    } else {
        console.log("Keyboard locking unsupported");
    }

    document.addEventListener("keydown", e => {
        if(e.key == "F4") {
            if(document.fullscreenElement == gameRoot) {
                document.exitFullscreen();
            } else {
                document.body.requestFullscreen();
            }
        }
    });
    

    async function connect(id: string) {
        const serverSession = await client.connect(id);            

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

    const serverSelect = document.querySelector('#ui .modal[data-name="server-select"]')!;

    (serverSelect.querySelector('[name="id"]') as HTMLInputElement).value = localStorage.getItem("lastserver") ?? "";

    serverSelect.addEventListener("submit", async (event: SubmitEvent) => {
        event.preventDefault();
        const submitter = event.submitter as HTMLInputElement;
        const data = new FormData(event.target as HTMLFormElement);

        console.log(submitter);

        const serverId = data.get("id").toString();
        const serverPeerId = "server-" + serverId + "-mvd";
        localStorage.setItem("lastserver", serverId);

        try {
            if(submitter.name == "connect") {
                await connect(serverPeerId);
            } else if(submitter.name == "create") {
                // Host server myself
                const server = new ServerManager(serverPeerId);
                await server.start();
                await connect(serverPeerId);
            }

            serverSelect.classList.remove("visible");
            gameRoot.classList.remove("hidden");
            gameRoot.focus();
        } catch(e) {
            serverSelect.querySelector(".connect-error").textContent = "Error while connecting/creating server " + serverId + ": " + e.message;
            console.error(e);
        }
    })
    

    await client.login(clientId);
}