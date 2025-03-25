export class PlayerController {
    public controllerRoot: HTMLElement;
    private keys: Set<string> = new Set;

    constructor(controllerRoot: HTMLElement) {
        this.controllerRoot = controllerRoot;

        this.initEvents();
    }

    private initEvents() {
        this.controllerRoot.addEventListener("keydown", e => {
            this.keys.add(e.key.toUpperCase());
        });
        this.controllerRoot.addEventListener("keyup", e => {
            this.keys.delete(e.key.toUpperCase());
        });
    }

    public keyDown(key: string) {
        return this.keys.has(key.toUpperCase());
    }
}