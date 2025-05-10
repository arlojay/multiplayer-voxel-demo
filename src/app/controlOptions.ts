export interface ClientCustomizationOptions {
    username: string;
    color: string;
}

export interface ClientOptions {
    controls: {
        mouseSensitivity: number;
        invertY: boolean;
    },
    customization: ClientCustomizationOptions,
    viewDistance: number;
}