import { Client } from "./app/client/client";
import { ServerSession } from "./app/client/serverSession";
import { debugLog } from "./app/logging";
import { Server } from "./app/server/server";
import { ServerManager, ServerPeerError } from "./app/server/serverManager";
import "./style.css";

const gameRoot = document.querySelector("#game") as HTMLElement;

function createRandomServerId() {
    const chars = "ACDEFGHJKMNPQRTWXYZ234679".split("");
    let str = "";

    for(let i = 0; i < 4; i++) {
        str += chars[Math.floor(Math.random() * chars.length)];
    }
    return str;
}

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
            debugLog("Locked keyboard events!");
        }).catch((e: any) => {
            debugLog(e.message);
            console.warn(e);
        });
    } else {
        debugLog("Keyboard locking unsupported");
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



    const worldCreation = document.querySelector('.modal[data-name="create-world"]')!;

    worldCreation.querySelector("form").addEventListener("submit", async (event: SubmitEvent) => {
        event.preventDefault();
        const data = new FormData(event.target as HTMLFormElement);

        const worldName = data.get("name").toString();

        let errored = false;
        let serverId: string = "";
        let server: ServerManager = null;
        worldCreation.classList.remove("visible");
        try {
            do {
                errored = false;
                serverId = createRandomServerId();
                
                // Host server myself
                server = new ServerManager(serverId, {
                    worldName
                });

                try {
                    await server.start();
                } catch(error) {
                    if(error instanceof ServerPeerError) {
                        console.log(error);
                        errored = true;
                    } else {
                        throw error;
                    }
                }
            } while(errored);

            const connection = await connect(serverId);
            connection.addListener("disconnected", () => {
                server.close();
            });

            gameRoot.classList.remove("hidden");
            gameRoot.focus();
        } catch(e) {
            worldCreation.classList.add("visible");
            alert(e.message);
            console.error(e);
        }
    })



    const gameSelect = document.querySelector('.modal[data-name="game-select"]')!;
    const serverSelect = document.querySelector('#join-game')!;
    
    async function connect(id: string) {
        gameSelect.classList.remove("visible");
        const serverSession = await client.connect("server-" + id.toUpperCase() + "-mvd");
        serverSession.addListener("disconnected", (reason) => {
            serverSelect.querySelector(".connect-error").textContent = "Kicked from server: " + reason;
            gameSelect.classList.add("visible");
            gameRoot.classList.add("hidden");
        })
        
        loadChunks(serverSession);
        return serverSession;
    }

    (serverSelect.querySelector('[name="id"]') as HTMLInputElement).value = localStorage.getItem("lastserver") ?? "";

    document.querySelector("#join-game").addEventListener("submit", async (event: SubmitEvent) => {
        event.preventDefault();
        const submitter = event.submitter as HTMLInputElement;
        const data = new FormData(event.target as HTMLFormElement);

        console.log(submitter);

        const serverId = data.get("id").toString();
        localStorage.setItem("lastserver", serverId);

        try {
            await connect(serverId);

            gameSelect.classList.remove("visible");
            gameRoot.classList.remove("hidden");
            gameRoot.focus();
        } catch(e) {
            serverSelect.querySelector(".connect-error").textContent = "Error while connecting/creating server " + serverId + ": " + e.message;
            console.error(e);
        }
    })
    
    document.querySelector("#create-world-btn").addEventListener("click", () => {
        console.log(serverSelect);
        worldCreation.classList.add("visible");
        gameSelect.classList.remove("visible");
    });
    

    await client.login(clientId);
}

function loadChunks(serverSession: ServerSession) {
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