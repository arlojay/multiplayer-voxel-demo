import { Client, getClient } from "./client/client";
import { ServerSession } from "./client/serverSession";
import { ClientCustomizationOptions } from "./controlOptions";
import { WorldDescriptor } from "./gameData";
import { debugLog } from "./logging";
import { ServerManager, ServerPeerError } from "./server/serverManager";

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

    const memoryCounter = document.querySelector("#memory-counter");
    setInterval(() => {
        const memory = (performance as any).memory;
        if(memory != null) {
            let count = (Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100).toString();
            let [ whole, frac ] = count.split(".");
            if(frac == null) frac = "";
            frac = frac.padEnd(2, "0");
            count = whole + "." + frac;
            memoryCounter.textContent = count + "MB used";
        }
    }, 100);



    const worldCreation = document.querySelector('.modal[data-name="create-world"]')!;

    worldCreation.querySelector("form").addEventListener("submit", async (event: SubmitEvent) => {
        event.preventDefault();
        const data = new FormData(event.target as HTMLFormElement);

        const worldName = data.get("name").toString();
        const databaseName = crypto.randomUUID();

        let server: ServerManager;

        try {
            worldCreation.classList.remove("visible");
            server = await createServer({
                name: worldName,
                location: databaseName,
                lastPlayed: null,
                dateCreated: null
            });

            await client.gameData.createWorld(worldName, databaseName);
            
            const connection = await connectToServer(server.id, getConnectionOptions());
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

    (serverSelect.querySelector('[name="id"]') as HTMLInputElement).value = localStorage.getItem("lastserver") ?? "";

    document.querySelector("#join-game").addEventListener("submit", async (event: SubmitEvent) => {
        event.preventDefault();
        const submitter = event.submitter as HTMLInputElement;
        const data = new FormData(event.target as HTMLFormElement);

        const serverId = data.get("id").toString();
        localStorage.setItem("lastserver", serverId);

        try {
            await connectToServer(serverId, getConnectionOptions());

            gameSelect.classList.remove("visible");
            gameRoot.classList.remove("hidden");
            gameRoot.focus();
        } catch(e) {
            serverSelect.querySelector(".connect-error").textContent = "Error while connecting/creating server " + serverId + ": " + e.message;
            console.error(e);
        }
    })
    
    document.querySelector("#create-world-btn").addEventListener("click", () => {
        worldCreation.classList.add("visible");
        gameSelect.classList.remove("visible");
    });

    document.querySelector("#player-username").addEventListener("change", () => {
        saveConnectionOptions();
    });
    document.querySelector("#player-color").addEventListener("change", () => {
        saveConnectionOptions();
    });
    await loadConnectionOptions();
    
    

    await client.login(clientId);
    await updateWorldListScreen();
}

async function saveConnectionOptions() {
    const gameData = getClient().gameData;

    gameData.clientOptions.customization.username = (document.querySelector("#player-username") as HTMLInputElement).value;
    gameData.clientOptions.customization.color = (document.querySelector("#player-color") as HTMLInputElement).value;

    gameData.saveClientOptions();
}

async function loadConnectionOptions() {
    const gameData = getClient().gameData;
    await gameData.loadClientOptions();

    (document.querySelector("#player-username") as HTMLInputElement).value = gameData.clientOptions.customization.username;
    (document.querySelector("#player-color") as HTMLInputElement).value = gameData.clientOptions.customization.color;
}

function getConnectionOptions(): ClientCustomizationOptions {
    return {
        username: (document.querySelector("#player-username") as HTMLInputElement).value,
        color: (document.querySelector("#player-color") as HTMLInputElement).value
    }
}

async function connectToServer(id: string, connectionOptions: ClientCustomizationOptions) {
    const gameSelect = document.querySelector('.modal[data-name="game-select"]')!;

    gameSelect.classList.remove("visible");
    const serverSession = await Client.instance.connect("server-" + id.toUpperCase() + "-mvd", connectionOptions);
    serverSession.addListener("disconnected", (reason) => {
        document.querySelector("#join-game .connect-error").textContent = "Kicked from server: " + reason;
        gameSelect.classList.add("visible");
        gameRoot.classList.add("hidden");
    })
    
    loadChunks(serverSession);
    return serverSession;
}

async function createServer(world: WorldDescriptor) {
    let errored = false;
    let serverId: string = "";
    let server: ServerManager = null;

    do {
        errored = false;
        serverId = createRandomServerId();
        
        // Host server myself
        server = new ServerManager(serverId, {
            worldName: world.location
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

    return server;
}

async function updateWorldListScreen() {
    const worldCreation = document.querySelector('.modal[data-name="create-world"]')!;
    const worldSelect = document.querySelector("#select-world")!;
    const dateFormatter = new Intl.RelativeTimeFormat();

    const children: Node[] = new Array;
    for(const worldDescriptor of Client.instance.gameData.worlds.values()) {
        const listItem = document.createElement("li");

        const itemName = document.createElement("span");
        itemName.classList.add("name");
        itemName.textContent = worldDescriptor.name;


        const time = document.createElement("time");
        time.dateTime = "|";

        const timePassed = (Date.now() - worldDescriptor.dateCreated.getTime()) / 1000;
        if(timePassed < 60) time.textContent = dateFormatter.format(-Math.floor(timePassed), "second");
        else if(timePassed < 60 * 60) time.textContent = dateFormatter.format(-Math.floor(timePassed / 60), "minute");
        else if(timePassed < 60 * 60 * 24) time.textContent = dateFormatter.format(-Math.floor(timePassed / 60 / 60), "hour");
        else time.textContent = dateFormatter.format(-Math.floor(timePassed / 60 / 60 / 24), "day");


        const playBtn = document.createElement("button");
        playBtn.textContent = "Play";
        playBtn.classList.add("play");

        playBtn.addEventListener("click", async () => {    
            let server: ServerManager;
    
            try {
                worldSelect.classList.remove("visible");
                server = await createServer(worldDescriptor);
                
                const connection = await connectToServer(server.id, getConnectionOptions());
                connection.addListener("disconnected", () => {
                    server.close();
                });
    
                gameRoot.classList.remove("hidden");
                gameRoot.focus();
            } catch(e) {
                worldSelect.classList.add("visible");
                alert(e.message);
                console.error(e);
            }
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.classList.add("delete");

        deleteBtn.addEventListener("click", async () => {
            const confirmed = confirm("Are you sure you want to delete the world \"" + worldDescriptor.name +"\"?");

            if(confirmed) {
                await Client.instance.gameData.deleteWorld(worldDescriptor);
                await updateWorldListScreen();
            }
        });



        listItem.append(itemName, time, playBtn, deleteBtn);
        children.push(listItem);
    }
    
    const list = worldSelect.querySelector("ul");
    list.replaceChildren(...children);
}

function loadChunks(serverSession: ServerSession) {
    serverSession.updateViewDistance();
    setInterval(() => {
        serverSession.updateViewDistance();
    }, 2000);
    // for(let x = -3; x < 3; x++) {
    //     for(let y = -3; y < 3; y++) {
    //         for(let z = -3; z < 3; z++) {
    //             serverSession.fetchChunk(x, y, z).then(response => {
    //                 const localChunk = serverSession.localWorld.blocks.getChunk(x, y, z);
    //                 localChunk.data.set(response.data);

    //                 serverSession.localWorld.markChunkDirty(localChunk);
    //                 serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x + 1, y, z));
    //                 serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x - 1, y, z));
    //                 serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x, y + 1, z));
    //                 serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x, y - 1, z));
    //                 serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x, y, z + 1));
    //                 serverSession.localWorld.markChunkDirty(serverSession.localWorld.blocks.getChunk(x, y, z - 1));
    //             });
    //         }
    //     }
    // }
}