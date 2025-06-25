export enum MouseKey {
    LEFT_CLICK = "mouse0",
    MIDDLE_CLICK = "mouse1",
    RIGHT_CLICK = "mouse2",
    NAV_BACK = "mouse3",
    NAV_FORWARD = "mouse4",
}

function translateKey(key: string) {
    if(key == " ") return "space";
    return key.toLowerCase();
}

export class KeyControl {
    public name: string;
    public defaultKey: string;
    public mapping: string;

    public constructor(name: string, defaultKey: string | MouseKey) {
        this.name = name;
        this.defaultKey = translateKey(defaultKey);
        this.set(defaultKey);
    }

    public set(mapping: string | MouseKey) {
        this.mapping = translateKey(mapping);
    }
    public is(key: string | MouseKey) {
        return translateKey(key) == this.mapping;
    }
    public get() {
        return this.mapping;
    }
    public isDefault() {
        return this.mapping == this.defaultKey;
    }
    public reset() {
        this.mapping = this.defaultKey;
    }
}

export const controls = {
    FORWARD: register("Forward", "w"),
    BACKWARD: register("Backward", "s"),
    STRAFE_RIGHT: register("Strafe Right", "d"),
    STRAFE_LEFT: register("Strafe Left", "a"),
    JUMP: register("Jump", "space"),

    RUN: register("Run", "shift"),
    CROUCH: register("Crouch", "c"),

    BREAK_BLOCK: register("Remove Block", "r"),
    PLACE_BLOCK: register("Place Block", "e"),

    FREECAM: register("Toggle Freecam", "u"),
    FREECAM_UP: register("Freecam Up", "e"),
    FREECAM_DOWN: register("Freecam Down", "q"),
}

function register(name: string, defaultKey: string) {
    const control = new KeyControl(name, defaultKey);
    return control;
}

export function serializeControls() {
    const mappings: Record<string, string> = {};
    for(const key of Object.keys(controls)) {
        mappings[key] = (controls as Record<string, KeyControl>)[key].get();
    }
    return mappings;
}

export function deserializeControls(serializedControls: Record<string, string>) {
    if(serializedControls == null) return;

    for(const key of Object.keys(serializedControls)) {
        if(key in controls) {
            (controls as Record<string, KeyControl>)[key].set(serializedControls[key]);
        }
    }
}