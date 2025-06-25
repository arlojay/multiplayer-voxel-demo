import { Client, getClient } from "./client/client";
import { ServerSession } from "./client/serverSession";
import { ClientCustomizationOptions } from "./controls/controlOptions";
import { dlerp, map } from "./math";
import { cloneDb, dbExists } from "./serialization/dbUtils";
import { PluginLoader } from "./server/pluginLoader";
import { ServerLaunchOptions } from "./server/server";
import { ServerData, ServerOptions } from "./server/serverData";
import { ServerManager, ServerPeerError } from "./server/serverManager";
import { getStats } from "./turn";
import { UIButton, UIFieldset, UIForm, UISection, UIText } from "./ui";
import { UIFormField, UIFormFieldInputSide } from "./ui/UIFormField";
import { UISpacer } from "./ui/UISpacer";
import { makeSettingsUI } from "./client/ui/settingsUI";
import { makeServerListUI } from "./client/ui/serverListUI";
import { ServerDescriptor } from "./client/gameData";
import { DataLibraryManager } from "./datalibrary/dataLibrary";
import { ImageLoader } from "three";

const gameRoot = document.querySelector("#game") as HTMLElement;
let serverListUI: UISection;

function createRandomServerGameCode() {
    const chars = "ACDEFGHJKMNPQRTWXYZ234679".split("");
    let str = "";

    for(let i = 0; i < 4; i++) {
        str += chars[Math.floor(Math.random() * chars.length)];
    }
    return str;
}

export class LoadingScreen {
    public element: HTMLDivElement;
    public visible: boolean;
    
    private titleElement: HTMLHeadingElement;
    private hintElement: HTMLDivElement;
    private stateElement: HTMLParagraphElement;
    private progressElement: HTMLDivElement;
    private progressBarElement: HTMLProgressElement;
    private progressTextElement: HTMLSpanElement;
    private cancelButton: HTMLButtonElement;

    public showHint = false;
    public showProgress = false;
    
    public title = "Loading";
    public hint: string = "";
    public progressMin = 0;
    public progressMax = 100;
    public progressValue = 0;

    public cancellable = true;
    private onCancelCallback: () => void;

    constructor(element: HTMLDivElement) {
        this.element = element;

        this.titleElement = this.element.querySelector("h1");
        this.hintElement = this.element.querySelector(".hint");
        this.stateElement = this.hintElement.querySelector(".state");
        this.progressElement = this.element.querySelector(".progress");
        this.progressBarElement = this.progressElement.querySelector("progress");
        this.progressTextElement = this.progressElement.querySelector("span");
        this.cancelButton = this.element.querySelector(".cancel");

        this.cancelButton.addEventListener("click", () => {
            if(!this.cancellable) return;

            this.onCancelCallback?.();
        });
    }
    public setVisible(visible: boolean) {
        if(visible) this.element.classList.add("visible");
        else this.element.classList.remove("visible");

        this.visible = visible;
    }

    public onCancel(callback: () => void) {
        this.onCancelCallback = callback;
    }

    public setTitle(title: string) {
        this.title = title;
        this.titleElement.textContent = this.title;
    }
    public setCancellable(cancellable: boolean) {
        this.cancellable = cancellable;
        this.cancelButton.hidden = !cancellable;
    }
    public clearHint() {
        this.showHint = false;
        this.stateElement.hidden = true;
    }
    public setHint(text: string) {
        this.showHint = true;
        this.stateElement.hidden = false;
        this.hint = text;

        this.stateElement.textContent = this.hint;
    }
    public clearProgress() {
        this.showProgress = false;
        this.progressElement.hidden = true;
    }
    public setProgress(progress: { min?: number, max?: number, value?: number }) {
        this.showProgress = true;
        this.progressElement.hidden = false;

        if(progress.min != null) this.progressMin = progress.min;
        if(progress.max != null) this.progressMax = progress.max;
        if(progress.value != null) this.progressValue = progress.value;

        this.progressBarElement.setAttribute("min", this.progressMin.toString());
        this.progressBarElement.setAttribute("max", this.progressMax.toString());
        this.progressBarElement.setAttribute("value", this.progressValue.toString());
        
        const percent = Math.round(map(this.progressValue, this.progressMin, this.progressMax, 0, 100)) + "%";
        this.progressBarElement.textContent = percent;
        this.progressTextElement.textContent = percent;
    }
}

export class GameUIControl {
    public loadingScreen = new LoadingScreen(document.querySelector("#loading-screen"));
    
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
    public setTitleScreenVisible(visible: boolean) {
        const element = document.querySelector("#title-screen");
        if(visible) {
            element.classList.add("visible");
        } else {
            element.classList.remove("visible");
        }
    }
    public setGameVisible(visible: boolean) {
        const element = document.querySelector("#game");
        if(visible) {
            element.classList.add("visible");
        } else {
            element.classList.remove("visible");
        }
    }
    public setServerConnectionError(error: string) {
        document.querySelector("#join-game .connect-error").textContent = error;
    }
}

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

main();

async function main() {
    const client = new Client(new GameUIControl);
    await client.init();
    (window as any).client = client;

    client.setDebugInfo(new DebugInfo(client));
    
    if("navigator" in window && "keyboard" in window.navigator) {
        (window.navigator as any).keyboard.lock([
            "KeyW", "KeyA", "KeyS", "KeyD", "Space"
        ]).then(() => {
            console.log("Locked keyboard events!");
        }).catch((e: any) => {
            console.log(e.message);
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



    const serverSelect = document.querySelector('#join-game')!;

    (serverSelect.querySelector('[name="id"]') as HTMLInputElement).value = localStorage.getItem("lastserver") ?? "";

    document.querySelector("#join-game").addEventListener("submit", async (event: SubmitEvent) => {
        event.preventDefault();
        const data = new FormData(event.target as HTMLFormElement);

        const serverId = data.get("id").toString();
        localStorage.setItem("lastserver", serverId);

        try {
            await connectToServer(serverId, getConnectionOptions());

            Client.instance.gameUIControl.setTitleScreenVisible(false);
            gameRoot.classList.remove("hidden");
            gameRoot.focus();
        } catch(e) {
            let rootError = e;
            while(rootError.cause != null) rootError = rootError.cause;
            
            Client.instance.gameUIControl.setServerConnectionError("Error while joining server " + serverId + ": " + rootError.message);
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


    const settingsUI = makeSettingsUI(client.gameData);
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
        const loadingScreen = Client.instance.gameUIControl.loadingScreen;

        loadingScreen.setTitle("Connecting to " + id);

        const showConnectionScreen = () => {
            loadingScreen.setVisible(true);
            Client.instance.gameUIControl.setTitleScreenVisible(false);
        }
        const returnToMainScreen = async () => {
            loadingScreen.setVisible(false);
            // await Client.instance.screenshot("last-server");
            // await Client.instance.gameUIControl.loadLastServerScreenshot(Client.instance.dataLibraryManager);

            Client.instance.gameUIControl.setGameVisible(false);
            Client.instance.gameUIControl.setTitleScreenVisible(true);
        }
        
        showConnectionScreen();

        const fullServerId = "server-" + id.toUpperCase() + "-mvd";
        const connectionController = await Client.instance.initServerConnection(fullServerId, connectionOptions);

        // catches errors and premature "disconnect" events
        connectionController.onerror = error => {
            returnToMainScreen();

            rej(new Error("Failed to connect to server", { cause: error }));
        };

        loadingScreen.onCancel(() => {
            connectionController.prematureServerSession.close("Cancelled by user"); // runs "disconnect" event
        })
        


        const connectedServerSession = await connectionController.promise; // resolves with completed server connection
        loadingScreen.setVisible(false);

        
        connectedServerSession.addListener("disconnected", reason => {
            Client.instance.gameUIControl.setServerConnectionError("Kicked from server: " + reason);
            returnToMainScreen();
            Client.instance.gameRenderer.destroyWorldRenderer();
        });

        Client.instance.gameUIControl.setGameVisible(true);
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
    if(serverListUI != null) {
        serverListUI.destroy();
    }
    serverListUI = makeServerListUI(Client.instance.gameData);

    serverListUI.setEventHandler("server-play", event => {
        const server: ServerDescriptor = event.data.server;

        server.lastPlayed.setTime(Date.now());
        Client.instance.gameData.updateServer(server).then(updateServerListScreen);
        
        serverListUI.hide();
        launchServer({
            id: server.id
        }).then(async serverManager => {
            const connection = await connectToServer(serverManager.serverCode, getConnectionOptions())
            .catch((error) => {
                serverManager.close(true);
                throw error;
            });
            connection.addListener("disconnected", () => {
                serverManager.close();
            });

            gameRoot.classList.remove("hidden");
            gameRoot.focus();
        })
        .catch(error => {
            serverListUI.show();
            let rootError = error;
            while(rootError.cause != null) rootError = rootError.cause;
            
            Client.instance.gameUIControl.setServerConnectionError("Error while starting server: " + rootError.message);
            console.error(error);
        });
    })
    serverListUI.setEventHandler("server-edit", event => {
        const server: ServerDescriptor = event.data.server;

        editServerConfig({
            id: server.id
        }, true);
    })
    serverListUI.setEventHandler("server-clone", event => {
        const server: ServerDescriptor = event.data.server;

        cloneServer(server.id, prompt("New server name", "Clone of " + server.name));
    })
    serverListUI.setEventHandler("server-delete", event => {
        const server: ServerDescriptor = event.data.server;

        const confirmed = confirm("Are you sure you want to delete the server \"" + server.name +"\"?");

        if(confirmed) {
            Client.instance.gameData.deleteServer(server.id).then(updateServerListScreen);
        }
    });

    document.querySelector("#select-server .container").replaceChildren(await serverListUI.update());
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

        const title = new UIText(updating ? "Modify Server" : "Modify New Server");
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

        const cancelButton = new UIButton(updating ? "Cancel" : "Delete");
        cancelButton.onClick(async () => {
            serverData.close();
            if(!updating) await Client.instance.gameData.deleteServer(launchOptions.id);
            createServerModal.classList.remove("visible");
            createServerModal.removeChild(root.element);
            updateServerListScreen();
        })

        root.addChild(cancelButton);

    
        root.update().then(element => {
            createServerModal.append(element);
            createServerModal.classList.add("visible");
        });
    });

    serverData.close();
}