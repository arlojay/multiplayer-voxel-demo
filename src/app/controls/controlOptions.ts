export class ClientCustomizationOptions {
    username: string = "player-" + Math.random().toString().slice(2);
    color: string = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
}

export class ClientControls {
    mouseSensitivity: number = 0.3;
    invertY: boolean = false;
    keybinds: Record<string, string> = {};
}

export class ClientOptions {
    controls = new ClientControls;
    customization = new ClientCustomizationOptions;
    viewDistance: number = 4;
    warnBeforeLeave: boolean = true;
    maxFPS: number = 60;
    budgetUpdateTime: number = 15;
    backgroundScreenshots: boolean = true;
}