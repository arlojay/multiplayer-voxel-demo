export class ClientCustomizationOptions {
    username: string = "player-" + Math.random().toString().slice(2);
    color: string = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
}

export class ClientControls {
    mouseSensitivity: number = 0.3;
    invertY: boolean = false;
}

export class ClientOptions {
    controls = new ClientControls;
    customization = new ClientCustomizationOptions;
    viewDistance: number = 4;
}