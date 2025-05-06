import { Client, getClient } from "./client/client";
import { ServerSession } from "./client/serverSession";
import { ClientCustomizationOptions } from "./controlOptions";
import { debugLog } from "./logging";
import { PluginLoader } from "./server/pluginLoader";
import { ServerLaunchOptions } from "./server/server";
import { ServerManager, ServerPeerError } from "./server/serverManager";
import { UIButton, UISection, UISliderInput, UIText, UITextInput } from "./ui";

const gameRoot = document.querySelector("#game") as HTMLElement;

function createRandomServerGameCode() {
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



    const serverCreation = document.querySelector('.modal[data-name="create-server"]')!;

    serverCreation.querySelector("form").addEventListener("submit", async (event: SubmitEvent) => {
        event.preventDefault();
        const data = new FormData(event.target as HTMLFormElement);

        const serverName = data.get("name").toString();

        let server: ServerManager;

        try {
            serverCreation.classList.remove("visible");
            const descriptor = await client.gameData.createServer(serverName);
            server = await launchServer({
                id: descriptor.id
            });
            
            const connection = await connectToServer(server.id, getConnectionOptions());
            connection.addListener("disconnected", () => {
                server.close();
            });

            gameRoot.classList.remove("hidden");
            gameRoot.focus();
        } catch(e) {
            serverCreation.classList.add("visible");
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
    
    document.querySelector("#create-server-btn").addEventListener("click", () => {
        serverCreation.classList.add("visible");
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
    await updateServerListScreen();

    const pluginList = document.querySelector("#plugin-list");
    for(const pluginName of PluginLoader.getPluginList()) {
        const element = document.createElement("li");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";

        const name = document.createElement("span");
        name.textContent = pluginName;

        element.append(checkbox, name);
        pluginList.append(element);

        element.addEventListener("click", e => {
            if(e.target != checkbox) checkbox.click();
        });
    }


    const settingsUI = makeSettingsUI();
    settingsUI.visible = false;
    await settingsUI.update();
    const settingsRoot = document.querySelector("#settings") as HTMLElement;
    settingsRoot.appendChild(settingsUI.element);

    document.querySelector("#game-settings").addEventListener("click", () => {
        settingsUI.visible = true;
        settingsUI.update();
    })
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

async function launchServer(launchOptions: ServerLaunchOptions) {
    let errored = false;
    let gameCode: string = "";
    let server: ServerManager = null;

    do {
        errored = false;
        gameCode = createRandomServerGameCode();
        
        server = new ServerManager(gameCode, launchOptions);

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

async function updateServerListScreen() {
    const serverCreation = document.querySelector('.modal[data-name="create-server"]')!;
    const serverSelect = document.querySelector("#select-server")!;
    const dateFormatter = new Intl.RelativeTimeFormat();

    const children: Node[] = new Array;
    for(const serverDescriptor of Client.instance.gameData.servers.values()) {
        const listItem = document.createElement("li");

        const itemName = document.createElement("span");
        itemName.classList.add("name");
        itemName.textContent = serverDescriptor.name;


        const time = document.createElement("time");
        time.dateTime = "|";

        const timePassed = (Date.now() - serverDescriptor.dateCreated.getTime()) / 1000;
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
                serverSelect.classList.remove("visible");
                server = await launchServer({
                    id: serverDescriptor.id
                });
                
                const connection = await connectToServer(server.id, getConnectionOptions());
                connection.addListener("disconnected", () => {
                    server.close();
                });
    
                gameRoot.classList.remove("hidden");
                gameRoot.focus();
            } catch(e) {
                serverSelect.classList.add("visible");
                alert(e.message);
                console.error(e);
            }
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.classList.add("delete");

        deleteBtn.addEventListener("click", async () => {
            const confirmed = confirm("Are you sure you want to delete the server \"" + serverDescriptor.name +"\"?");

            if(confirmed) {
                await Client.instance.gameData.deleteServer(serverDescriptor);
                await updateServerListScreen();
            }
        });



        listItem.append(itemName, time, playBtn, deleteBtn);
        children.push(listItem);
    }
    
    const list = serverSelect.querySelector("ul");
    list.replaceChildren(...children);
}

function makeSettingsUI() {
    const root = new UISection;

    const title = new UIText("Settings");
    title.style.fontSize = "2rem";
    title.style.fontWeight = "bold";
    root.addChild(title);


    const gameData = Client.instance.gameData;

    interface SettingsOption<T> {
        name: string;
        type: string;
        default: T;

        set(value: T): void;
        get(): T;

        min?: number;
        max?: number;
        step?: number;
    }

    const options: SettingsOption<any>[] = [
        {
            name: "View Distance",
            type: "number",
            default: 4,
            min: 2,
            max: 16,
            step: 1,
            set: (value: number) => gameData.clientOptions.viewDistance = value,
            get: () => gameData.clientOptions.viewDistance
        } as SettingsOption<number>
    ];

    for(const option of options) {
        const element = new UISection;

        const name = new UIText(option.name);
        element.addChild(name);

        if(option.type == "number") {
            if("min" in option || "max" in option) {
                const slider = new UISliderInput(option.get(), option.min ?? 0, option.max ?? 1000, option.step ?? 1);
                const sliderText = new UIText(option.get() + "");
                slider.onChange(() => {
                    option.set(slider.value);
                    gameData.saveClientOptions();
                });
                slider.onInput(() => {
                    sliderText.text = slider.value + "";
                    sliderText.update();
                });

                element.addChild(slider);
                element.addChild(sliderText);
            } else {
                const input = new UITextInput(option.default + "", option.get() + "");
                input.inputType = "number";
                input.onChange(() => {
                    option.set(+input.value);
                    gameData.saveClientOptions();
                });

                element.addChild(input);
            }
        }

        root.addChild(element);
    }

    const closeButton = new UIButton("Close");
    closeButton.onClick(() => {
        root.visible = false;
        root.update();
    })
    root.addChild(closeButton);

    return root;
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