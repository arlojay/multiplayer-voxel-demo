import { ImageLoader } from "three";
import { DataLibraryManager } from "./datalibrary/dataLibrary";
import { LoadingScreen } from "./loadingScreen";
import { UIContainer } from "./ui";
import { controls } from "./controls/controlsMap";

interface ShowUIOptions {
    blocking: boolean;
    spotlight: boolean;
    closable: boolean;
}

export class GameUIControl {
    public loadingScreen = new LoadingScreen(document.querySelector("#loading-screen"));
    private gameRoot: HTMLElement;
    private UIRoot: HTMLElement;
    private showingUIs: UIContainer[] = new Array;
    private showingUIOptions: Map<UIContainer, ShowUIOptions> = new Map;
    private uiSpotlightBackground: HTMLElement;

    constructor(gameRoot: HTMLElement) {
        this.gameRoot = gameRoot;
        this.UIRoot = gameRoot.querySelector("#game-ui");
        this.uiSpotlightBackground = this.UIRoot.querySelector("#spotlight-background");

        document.body.addEventListener("keydown", (event) => {
            if(event.repeat) return;
            if(controls.CLOSE_MENU.is(event.key)) {
                this.closeOneClosableUI();
            }
        })
    }
    
    public getRoot() {
        return this.gameRoot;
    }
    public getCanvas() {
        return this.gameRoot.querySelector("canvas") as HTMLCanvasElement;
    }
    public getUI() {
        return this.UIRoot;
    }
    public isOnTab() {
        return document.visibilityState == "visible";
    }
    public isNotFocusedOnAnything() {
        return (
            document.activeElement == document.body ||
            document.activeElement == this.getCanvas() ||
            document.activeElement == this.UIRoot
        );
    }
    public hasDocumentFocus() {
        return document.hasFocus();
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
    public async loadLastServerScreenshot(dataLibraryManager: DataLibraryManager) {
        const library = await dataLibraryManager.getLibrary("screenshots");
        await library.open(null);
        return await library.getAsset("last-server").then(async asset => {
            const titleBackground = document.querySelector("#title-background") as HTMLDivElement;
            titleBackground.replaceChildren();

            const image = await new ImageLoader().loadAsync(URL.createObjectURL(asset.item.blob));;
            titleBackground.append(image);
        }).catch((error) => {
            console.warn("Cannot open last server screenshot", error);
        });
    }
    public someBlockingUIOpen() {
        return this.showingUIOptions.values().some(options => options.blocking);
    }
    public someSpotlightUIOpen() {
        return this.showingUIOptions.values().some(options => options.spotlight);
    }
    public closeOneClosableUI() {
        for(let i = this.showingUIs.length - 1; i >= 0; i--) {
            const ui = this.showingUIs[i];
            const options = this.showingUIOptions.get(ui);
            if(options.closable) {
                this.closeUI(ui);
                return true;
            }
        }

        return false;
    }
    public async showUI(ui: UIContainer, options: ShowUIOptions) {
        this.showingUIs.push(ui);
        this.showingUIOptions.set(ui, options);

        if(options.spotlight) {
            ui.onUpdate(() => {
                ui.element.classList.add("spotlight");
            });
        }
        this.UIRoot.appendChild(await ui.update());


        this.updateSpotlightBackground();
    }
    public closeUI(ui: UIContainer) {
        this.showingUIs.splice(this.showingUIs.indexOf(ui), 1);
        this.showingUIOptions.delete(ui);
        if(this.UIRoot.contains(ui.element)) this.UIRoot.removeChild(ui.element);

        this.updateSpotlightBackground();
    }
    private updateSpotlightBackground() {
        if(this.someSpotlightUIOpen()) {
            this.uiSpotlightBackground.classList.remove("hidden");
        } else {
            this.uiSpotlightBackground.classList.add("hidden");
        }
    }
}