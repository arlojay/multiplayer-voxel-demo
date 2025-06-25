import { $enum } from "ts-enum-util";
import { Client, getClient } from "./client/client";
import { ServerSession } from "./client/serverSession";
import { ClientCustomizationOptions } from "./controlOptions";
import { controls, KeyControl, MouseKey } from "./controlsMap";
import { cloneDb, dbExists } from "./dbUtils";
import { debugLog } from "./logging";
import { dlerp, map } from "./math";
import { PluginLoader } from "./server/pluginLoader";
import { ServerLaunchOptions } from "./server/server";
import { ServerData, ServerOptions } from "./server/serverData";
import { ServerManager, ServerPeerError } from "./server/serverManager";
import { getStats } from "./turn";
import { UIButton, UIElement, UIFieldset, UIForm, UISection, UISliderInput, UIText, UITextInput } from "./ui";
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

export class GameUIControl {
    public setLoadingHint(visible: boolean, text: string, progress?: { min?: number, max: number, value: number }) {
        if(progress != null) {
            progress.min ??= 0;
        }
        if(visible) console.debug("Loading... ", text, progress != null ? (Math.round(map(progress.value, progress.min, progress.max, 0, 100)) + "%") : "");
        
        document.querySelectorAll(".loading-hint").forEach((hintElement: HTMLElement) => {
            hintElement.hidden = !visible;
            hintElement.querySelector(".state").textContent = text;
            const progressContainer = hintElement.querySelector(".progress") as HTMLDivElement;
            const progressElement = progressContainer.querySelector("progress");

            if(progress == null) {
                progressContainer.hidden = true;
            } else {
                progressContainer.hidden = false;

                progressElement.setAttribute("min", progress.min.toString());
                progressElement.setAttribute("max", progress.max.toString());
                progressElement.setAttribute("value", progress.value.toString());
                progressElement.textContent = Math.round(map(progress.value, progress.min, progress.max, 0, 100)) + "%";
                hintElement.querySelector(".progress-text").textContent = progressElement.textContent;
            }
        })
    }
    public getRoot() {
        return gameRoot;
    }
    public getCanvas() {
        return gameRoot.querySelector("canvas") as HTMLCanvasElement;
    }
    public getUI() {
        return gameRoot.querySelector("#game-ui") as HTMLDivElement;
    }
    public isOnTab() {
        return document.visibilityState == "visible";
    }
    public isNotFocusedOnAnything() {
        return document.activeElement == document.body;
    }
    public waitForRepaint() {
        return new Promise<number>(requestAnimationFrame);
    }
}

main();

export class DebugInfo {
    private performanceMeter: HTMLDivElement;
    private memCounter: HTMLDivElement;
    private fpsCounter: HTMLDivElement;
    private frametimeCounter: HTMLDivElement;
    private networkCounter: HTMLDivElement;
    private drawCallsCounter: HTMLDivElement;
    private memused: number;
    private displayMemused: number;
    private lastSentBytes: number;
    private lastSentByteInterval: number;
    private lastRecvBytes: number;
    private lastRecvByteInterval: number;
    private lastTime: number;
    private lastDrawCalls: number;
    private drawCalls: number;

    private cbs: ({ time: number, run: () => void })[];
    private client: Client;

    constructor(client: Client) {
        this.client = client;
        this.performanceMeter = document.querySelector("#perf-meters");
        this.memCounter = this.performanceMeter.querySelector(".mem");
        this.fpsCounter = this.performanceMeter.querySelector(".fps");
        this.frametimeCounter = this.performanceMeter.querySelector(".frametime");
        this.networkCounter = this.performanceMeter.querySelector(".network");
        this.drawCallsCounter = this.performanceMeter.querySelector(".draw-calls");

        this.memused = 0;
        this.displayMemused = 0;
        this.lastSentBytes = 0;
        this.lastSentByteInterval = 0;
        this.lastRecvBytes = 0;
        this.lastRecvByteInterval = 0;

        this.cbs = new Array;
        this.lastTime = 0;
        this.lastDrawCalls = 0;

        setInterval(() => {
            const memory = (performance as any).memory;
            if(memory != null) {
                this.memused = memory.usedJSHeapSize / 1024 / 1024;
            }
            this.updateElements();
        }, 100)
    }
    public decimalToAccuracy(value: number, places: number) {
        const n = 10 ** places;
        const count = (Math.round(value * n) / n).toString();
        let [ whole, frac ] = count.split(".");
        if(frac == null) frac = "";
        frac = frac.padEnd(places, "0");

        return whole + "." + frac;
    }
    public update(time: number) {
        while(this.cbs[0]?.time < time) this.cbs.shift().run();

        if(this.client.serverSession?.serverConnection != null) {
            getStats(this.client.serverSession.serverConnection).then(stats => {
                if(stats != null) {
                    const sent = stats.bytesSent - this.lastSentBytes;
                    this.lastSentBytes = stats.bytesSent;
                    this.lastSentByteInterval += sent;

                    const recv = stats.bytesReceived - this.lastRecvBytes;
                    this.lastRecvBytes = stats.bytesReceived;
                    this.lastRecvByteInterval += recv;

                    if(sent > 0 || recv > 0) this.cbs.push({ time, run() {
                        this.lastSentByteInterval -= sent;
                        this.lastRecvByteInterval -= recv;
                    }})
                }
            });
        }


        const dt = (time - this.lastTime);
        this.lastTime = time;

        this.displayMemused = Math.min(this.memused, dlerp(this.displayMemused, this.memused, dt, 5));
            
        this.drawCalls = this.client.gameRenderer.renderer.info.calls - this.lastDrawCalls;
        this.lastDrawCalls = this.client.gameRenderer.renderer.info.calls;
        this.client.gameRenderer.renderer.info.reset();
    }
    public updateElements() {
        this.memCounter.textContent = this.decimalToAccuracy(this.displayMemused, 2) + "MB used";
        
        if(this.client.gameRenderer != null) {
            this.fpsCounter.textContent = Math.round(this.client.gameRenderer.framerate) + " FPS";
            this.frametimeCounter.textContent = this.decimalToAccuracy(this.client.gameRenderer.frametime * 1000, 3) + " ms/f";
            this.drawCallsCounter.textContent = this.drawCalls + " calls/f";
        }
        if(this.client.peer != null) {
            this.networkCounter.textContent = (
                this.decimalToAccuracy(this.lastSentByteInterval / 1024, 2).padStart(10, " ") + "kB/s up" +
                this.decimalToAccuracy(this.lastRecvByteInterval / 1024, 2).padStart(10, " ") + "kB/s down"
            );
        }
    }
}

async function main() {
    const client = new Client(new GameUIControl);
    await client.init();
    (window as any).client = client;

    client.setDebugInfo(new DebugInfo(client));
    
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
    gameData.clientOptions.customization.color = (document.querySelector("#player-color") as HTMLInputElement).value.replace("#", "");

    gameData.saveClientOptions();
}

async function loadConnectionOptions() {
    const gameData = getClient().gameData;

    (document.querySelector("#player-username") as HTMLInputElement).value = gameData.clientOptions.customization.username;
    (document.querySelector("#player-color") as HTMLInputElement).value = "#" + gameData.clientOptions.customization.color.replace("#", "");
}

function getConnectionOptions(): ClientCustomizationOptions {
    return {
        username: (document.querySelector("#player-username") as HTMLInputElement).value,
        color: (document.querySelector("#player-color") as HTMLInputElement).value.replace("#", "")
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

        const cloneBtn = document.createElement("button");
        cloneBtn.textContent = "Clone";
        cloneBtn.classList.add("clone");
        cloneBtn.addEventListener("click", () => {
            cloneServer(serverDescriptor.id, prompt("New server name", "Clone of " + serverDescriptor.name));
        })

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.classList.add("delete");

        deleteBtn.addEventListener("click", async () => {
            const confirmed = confirm("Are you sure you want to delete the server \"" + serverDescriptor.name +"\"?");

            if(confirmed) {
                await Client.instance.gameData.deleteServer(serverDescriptor.id);
                await updateServerListScreen();
            }
        });



        listItem.append(itemName, time, playBtn, editBtn, cloneBtn, deleteBtn);
        children.push(listItem);
    }
    
    const list = serverSelect.querySelector("ul");
    list.replaceChildren(...children);
}

function makeSettingsUI() {
    const root = new UIFieldset("Settings");
    
    root.onUpdate(() => {
        root.element.addEventListener("keydown", event => {
            if(event.key.toLowerCase() == "escape") {
                closeButton.click();
            }
        });
    })

    root.legend.style.fontSize = "2rem";
    root.legend.style.fontWeight = "bold";
    root.legend.style.textAlign = "center";


    const gameData = Client.instance.gameData;

    interface SettingsOption<T> {
        name: string;
        type: "number" | "boolean";
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
        } as SettingsOption<number>,
        {
            name: "Invert Y",
            type: "boolean",
            default: false,
            set: (value: boolean) => gameData.clientOptions.controls.invertY = value,
            get: () => gameData.clientOptions.controls.invertY
        } as SettingsOption<boolean>
    ];

    for(const option of options) {
        const element = new UISection;

        if(option.type == "number") {
            if("min" in option || "max" in option) {
                const slider = new UIFormField("slider", option.name, option.get());
                slider.min = option.min ?? 0;
                slider.max = option.max ?? 1000;
                slider.step = option.step ?? 1;
                slider.displayValue = true;
                
                slider.onChange(() => {
                    option.set(slider.value);
                    gameData.saveClientOptions();
                });

                element.addChild(slider);
            } else {
                const number = new UIFormField("number", option.name, option.get().toString());
                number.displayValue = true;

                number.placeholder = option.default.toString();
                number.onChange(() => {
                    option.set(+number.value);
                    gameData.saveClientOptions();
                });

                element.addChild(number);
            }
        } else if(option.type == "boolean") {
            const checkbox = new UIFormField("checkbox", option.name);
            checkbox.displayValue = true;
            checkbox.checked = option.get();

            checkbox.onChange(() => {
                option.set(checkbox.checked);
                gameData.saveClientOptions();
            });

            element.addChild(checkbox);
        }

        root.addChild(element);
    }
    
    const makeControlElement = (binding: KeyControl) => {
        const element = new UISection;
        element.style.display = "grid";
        element.style.gridTemplateColumns = "1fr repeat(2, max-content)";

        const name = new UIText(binding.name);
        element.addChild(name);

        const resetKeybindButton = new UIButton();
        resetKeybindButton.onClick(() => {
            binding.reset();
            updateAll();
        });
        element.addChild(resetKeybindButton);

        const changeKeybindButton = new UIButton();
        changeKeybindButton.onUpdate(() => {
            changeKeybindButton.element.addEventListener("contextmenu", event => event.preventDefault());
            changeKeybindButton.element.addEventListener("mouseup", event => event.preventDefault());
        });
        changeKeybindButton.onClick(async () => {
            await changeKeybindButton.setText("<Press>");

            console.log(changeKeybindButton.element);

            changeKeybindButton.element.tabIndex = 0;
            changeKeybindButton.element.focus();
            changeKeybindButton.element.requestPointerLock();
            
            changeKeybindButton.element.addEventListener("keydown", event => {
                event.preventDefault();
                binding.set(event.key);
                document.exitPointerLock();
                gameData.saveClientOptions();
                updateAll();
            });
            changeKeybindButton.element.addEventListener("mousedown", event => {
                event.preventDefault();
                const mouseButton = $enum(MouseKey).asValueOrThrow("mouse" + event.button);
                
                binding.set(mouseButton);
                document.exitPointerLock();
                gameData.saveClientOptions();
                updateAll();
            });
            changeKeybindButton.element.addEventListener("focusout", () => {
                updateAll();
            })
        })
        element.addChild(changeKeybindButton);

        const updateAll = () => {
            changeKeybindButton.text = binding.mapping.toUpperCase();

            resetKeybindButton.text = "Reset (" + binding.defaultKey.toUpperCase() + ")";
            resetKeybindButton.visible = !binding.isDefault();
            
            element.update();
        }
        updateAll();

        return element;
    }

    const makeControlCategory = (name: string, ...controls: KeyControl[]) => {
        const category = new UISection;
        category.style.marginBottom = "1rem";

        const element = new UIText(name);
        element.style.display = "block";
        element.style.width = "100%";
        element.style.textAlign = "center";
        element.style.fontWeight = "bold";

        category.addChild(element);
        for(const control of controls) category.addChild(makeControlElement(control));

        return category;
    }
    

    const keybindsSection = new UIFieldset("Keybinds");
    keybindsSection.style.margin = "1rem 0";
    keybindsSection.legend.style.textAlign = "center";

    keybindsSection.addChild(makeControlCategory(
        "MOVEMENT",
        controls.FORWARD,
        controls.BACKWARD,
        controls.STRAFE_LEFT,
        controls.STRAFE_RIGHT,
        controls.JUMP
    ));
    
    keybindsSection.addChild(makeControlCategory(
        "MODIFIERS",
        controls.RUN,
        controls.CROUCH
    ));
    
    keybindsSection.addChild(makeControlCategory(
        "WORLD",
        controls.PLACE_BLOCK,
        controls.BREAK_BLOCK
    ));

    keybindsSection.addChild(makeControlCategory(
        "FREECAM",
        controls.FREECAM,
        controls.FREECAM_DOWN,
        controls.FREECAM_UP
    ));

    keybindsSection.elements[keybindsSection.elements.length - 1].style.marginBottom = "";

    root.addChild(keybindsSection);

    const closeButton = new UIButton("Close");
    closeButton.onClick(() => {
        root.visible = false;
        root.update();
    })
    root.addChild(closeButton);

    return root;
}

async function cloneServer(serverId: string, newName: string) {
    const newServer = await Client.instance.gameData.createServer(newName)
    const newId = newServer.id;

    await cloneDb("servers/" + serverId, "servers/" + newId);

    const serverData = new ServerData(newId, new ServerOptions);
    await serverData.open();
    await serverData.loadAll();
    serverData.options.name = newName;
    await serverData.saveOptions();
    serverData.close();

    for(const pluginId of serverData.options.plugins) {
        if(await dbExists("servers/" + serverId + "/data/" + pluginId)) {
            await cloneDb(
                "servers/" + serverId + "/data/" + pluginId,
                "servers/" + newId + "/data/" + pluginId
            );
        }
    }
    for(const world of serverData.worlds.values()) {
        if(await dbExists("servers/" + serverId + "/worlds/" + world.id)) {
            await cloneDb(
                "servers/" + serverId + "/worlds/" + world.id,
                "servers/" + newId + "/worlds/" + world.id
            );
        }
    }

    await updateServerListScreen();
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
            Client.instance.gameData.deleteServer(launchOptions.id);
            createServerModal.classList.remove("visible");
            createServerModal.removeChild(root.element);
        })

        root.addChild(cancelButton);

    
        root.update().then(element => {
            createServerModal.append(element);
            createServerModal.classList.add("visible");
        });
    });

    serverData.close();
}