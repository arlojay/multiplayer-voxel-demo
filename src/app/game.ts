import { Client, getClient } from "./client/client";
import { ServerSession } from "./client/serverSession";
import { ClientCustomizationOptions } from "./controlOptions";
import { debugLog } from "./logging";
import { dlerp } from "./math";
import { PluginLoader } from "./server/pluginLoader";
import { ServerLaunchOptions } from "./server/server";
import { ServerData, ServerOptions } from "./server/serverData";
import { ServerManager, ServerPeerError } from "./server/serverManager";
import { getStats } from "./turn";
import { UIButton, UIFieldset, UIForm, UISection, UISliderInput, UIText, UITextInput } from "./ui";
import { UIFormField, UIFormFieldInputSide } from "./ui/UIFormField";
import { UISpacer } from "./ui/UISpacer";

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

    const performanceMeter = document.querySelector("#perf-meters");
    const memCounter = performanceMeter.querySelector(".mem");
    const fpsCounter = performanceMeter.querySelector(".fps");
    const frametimeCounter = performanceMeter.querySelector(".frametime");
    const networkCounter = performanceMeter.querySelector(".network");

    function decimalToAccuracy(value: number, places: number) {
        const n = 10 ** places;
        const count = (Math.round(value * n) / n).toString();
        let [ whole, frac ] = count.split(".");
        if(frac == null) frac = "";
        frac = frac.padEnd(places, "0");

        return whole + "." + frac;
    }

    let memused = 0;
    let displayMemused = 0;
    let lastSentBytes = 0;
    let lastSentByteInterval = 0;
    let lastRecvBytes = 0;
    let lastRecvByteInterval = 0;
    setInterval(() => {
        const memory = (performance as any).memory;
        if(memory != null) {
            memused = memory.usedJSHeapSize / 1024 / 1024;
        }
    }, 10);

    const cbs: ({ time: number, run: () => void })[] = new Array;
    let lastTime = 0;

    const cb = (time: number) => {
        while(cbs[0]?.time + 1000 < lastTime) cbs.shift().run();

        if(client.serverSession?.serverConnection != null) {
            getStats(client.serverSession.serverConnection).then(stats => {
                if(stats != null) {
                    const sent = stats.bytesSent - lastSentBytes;
                    lastSentBytes = stats.bytesSent;
                    lastSentByteInterval += sent;

                    const recv = stats.bytesReceived - lastRecvBytes;
                    lastRecvBytes = stats.bytesReceived;
                    lastRecvByteInterval += recv;

                    if(sent > 0 || recv > 0) cbs.push({ time: lastTime, run() {
                        lastSentByteInterval -= sent;
                        lastRecvByteInterval -= recv;
                    }})
                }
            });
        }


        const dt = (time - lastTime) / 1000;
        lastTime = time;

        displayMemused = Math.min(memused, dlerp(displayMemused, memused, dt, 5));
        memCounter.textContent = decimalToAccuracy(displayMemused, 2) + "MB used";
        
        if(client.gameRenderer != null) {
            fpsCounter.textContent = Math.round(client.gameRenderer.framerate) + " FPS";
            frametimeCounter.textContent = decimalToAccuracy(client.gameRenderer.frametime * 1000, 3) + " ms/frame";
        }
        if(client.peer != null) {
            networkCounter.textContent = decimalToAccuracy(lastSentByteInterval / 1024, 2).padStart(10, " ") + "kB/s up" + decimalToAccuracy(lastRecvByteInterval / 1024, 2).padStart(10, " ") + "kB/s down"
        }
        requestAnimationFrame(cb);
    };
    requestAnimationFrame(cb);



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
            let rootError = e;
            while(rootError.cause != null) rootError = rootError.cause;
            
            serverSelect.querySelector(".connect-error").textContent = "Error while joining server " + serverId + ": " + rootError.message;
            console.error(e);
        }
    })
    
    document.querySelector("#create-server-btn").addEventListener("click", async () => {
        const launchOptions = await Client.instance.gameData.createServer("New Server");
        await editServerConfig({
            id: launchOptions.id
        });
    });

    document.querySelector("#player-username").addEventListener("change", () => {
        saveConnectionOptions();
    });
    document.querySelector("#player-color").addEventListener("change", () => {
        saveConnectionOptions();
    });
    await loadConnectionOptions();
    
    

    await client.login();
    await updateServerListScreen();


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
    return await new Promise<ServerSession>(async (res, rej) => {
        const gameSelect = document.querySelector('.modal[data-name="game-select"]')!;
        const connectionError = document.querySelector("#join-game .connect-error");
        const serverConnection = document.querySelector('.modal[data-name="server-connection"]')!;
        const serverConnectionIdElement = serverConnection.querySelector(".server-id");
        const cancelConnectionButton = serverConnection.querySelector(".cancel");


        serverConnectionIdElement.textContent = id;

        const showConnectionScreen = () => {
            serverConnection.classList.add("visible");
            gameSelect.classList.remove("visible");
        }
        const returnToMainScreen = () => {
            gameSelect.classList.add("visible");
            gameRoot.classList.add("hidden");
            serverConnection.classList.remove("visible");
        }
        
        showConnectionScreen();

        const fullServerId = "server-" + id.toUpperCase() + "-mvd";
        const connectionController = await Client.instance.initServerConnection(fullServerId, connectionOptions);

        // catches errors and premature "disconnect" events
        connectionController.onerror = error => {
            cancelConnectionButton.removeEventListener("click", cancelButtonCallback);
            returnToMainScreen();

            rej(new Error("Failed to connect to server", { cause: error }));
        };

        const cancelButtonCallback = () => {
            connectionController.prematureServerSession.close("Cancelled by user"); // runs "disconnect" event
            cancelConnectionButton.removeEventListener("click", cancelButtonCallback);
        };

        cancelConnectionButton.addEventListener("click", cancelButtonCallback);
        


        const connectedServerSession = await connectionController.promise; // resolves with completed server connection
        serverConnection.classList.remove("visible");
        cancelConnectionButton.removeEventListener("click", cancelButtonCallback);
        
        loadChunks(connectedServerSession);

        
        connectedServerSession.addListener("disconnected", reason => {
            connectionError.textContent = "Kicked from server: " + reason;
            returnToMainScreen();
            Client.instance.gameRenderer.destroyWorldRenderer();
        });
        res(connectedServerSession);
    })
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

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.classList.add("edit");
        editBtn.addEventListener("click", () => {
            editServerConfig({
                id: serverDescriptor.id
            }, true);
        })

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



        listItem.append(itemName, time, playBtn, editBtn, deleteBtn);
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
            min: 1,
            max: 12,
            step: 0.1,
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
                sliderText.style.width = "3rem";
                sliderText.style.display = "inline-block";
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

async function editServerConfig(launchOptions: ServerLaunchOptions, updating = false) {
    const createServerModal = document.querySelector('.modal[data-name="create-server"]');
    if(createServerModal == null) throw new ReferenceError("Cannot find server creation modal");

    const serverOptions = new ServerOptions;
    serverOptions.name = Client.instance.gameData.servers.get(launchOptions.id)?.name ?? serverOptions.name;
    const serverData = new ServerData(launchOptions.id, serverOptions);
    await serverData.open();
    await serverData.loadAll();

    await new Promise((res, rej) => {
        const root = new UIForm;

        const title = new UIText(updating ? "Modify Server" : "Create Server");
        title.style.fontSize = "2em";
        title.style.fontWeight = "bold";
        root.addChild(title);

        const generalSection = new UIFieldset("General");
        const serverName = new UIFormField("text", "Server Name", serverOptions.name);
        serverName.onChange(() => serverOptions.name = serverName.value);
        generalSection.addChild(serverName);

        const pluginsSection = new UIFieldset("Plugins");
        const pluginList = new UISection;
        pluginList.style.display = "flex";
        pluginList.style.flexDirection = "column";
        pluginList.style.textAlign = "left";

        for(const pluginName of PluginLoader.getPluginList()) {
            const pluginCheckbox = new UIFormField("checkbox", pluginName, serverOptions.plugins.includes(pluginName) ? "on" : "off");
            pluginCheckbox.alignment = UIFormFieldInputSide.LEFT;
            pluginCheckbox.style.width = "100%";
            pluginList.addChild(pluginCheckbox);
            pluginCheckbox.onChange(() => {
                if(pluginCheckbox.value == "on") {
                    if(!serverOptions.plugins.includes(pluginName)) serverOptions.plugins.push(pluginName);
                } else {
                    serverOptions.plugins.splice(serverOptions.plugins.indexOf(pluginName), 1);
                }
            })
        }        
        
        const removeAllBtn = new UIButton("Remove All");
        removeAllBtn.onClick(() => {
            for(const element of pluginList.elements) {
                if(element instanceof UIFormField) {
                    element.checked = false;
                }
            }
            pluginList.update();
        })
        
        pluginsSection.addChild(pluginList);
        pluginsSection.addChild(removeAllBtn);

        root.addChild(generalSection);
        root.addChild(pluginsSection);
        root.addChild(new UISpacer);
        
        const submitButton = new UIButton(updating ? "Save" : "Create");
        submitButton.onClick(() => {
            const client = Client.instance;
            const serverListing = client.gameData.servers.get(launchOptions.id);
            let promise = Promise.resolve();

            if(serverListing != null) {
                serverListing.name = serverOptions.name;
                promise = promise.then(() => client.gameData.updateServer(serverListing));
            }

            promise = promise
                .then(() => serverData.saveOptions())
                .then(() => updateServerListScreen())

            promise.then(res).catch(rej).finally(() => {
                serverData.close();
                createServerModal.classList.remove("visible");
                createServerModal.removeChild(root.element);
            });
        });
        root.addChild(submitButton);

        const cancelButton = new UIButton("Cancel");
        cancelButton.onClick(() => {
            serverData.close();
            createServerModal.classList.remove("visible");
            createServerModal.removeChild(root.element);
        })

        root.addChild(cancelButton);

    
        root.update().then(element => {
            createServerModal.append(element);
            createServerModal.classList.add("visible");
        });
    });
}

function loadChunks(serverSession: ServerSession) {
    serverSession.updateViewDistance();
    const interval = setInterval(() => {
        serverSession.updateViewDistance();
    }, 2000);

    serverSession.addListener("disconnected", () => {
        clearInterval(interval);
    });
}