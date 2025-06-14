import { Vector2 } from "three";
import { capabilities } from "./capability";

export class PlayerController {
    public pointerRoot: HTMLElement;
    public keyboardRoot: HTMLElement;
    public lockPointer: boolean = false;
    public pointerCurrentlyLocked: boolean = false;
    private keys: Set<string> = new Set;

    public pointer = new Vector2;
    public pointerMovement = new Vector2;

    public leftPointer = false;
    public rightPointer = false;
    public middlePointer = false;
    public backPointer = false;
    public forwardPointer = false;

    constructor(controllerRoot: HTMLElement) {
        this.pointerRoot = controllerRoot;
        this.keyboardRoot = controllerRoot;

        this.initEvents();
    }

    private initEvents() {
        const updatePointer = (event: MouseEvent) => {
            this.pointer.x = event.clientX;
            this.pointer.y = event.clientY;

            this.leftPointer = (event.buttons & 0b00001) > 0;
            this.rightPointer = (event.buttons & 0b00010) > 0;
            this.middlePointer = (event.buttons & 0b00100) > 0;
            this.backPointer = (event.buttons & 0b01000) > 0;
            this.forwardPointer = (event.buttons & 0b10000) > 0;

            this.pointerMovement.x += event.movementX;
            this.pointerMovement.y += event.movementY;

            if(this.pointerCurrentlyLocked) {
                this.keyboardRoot.focus?.();
            }
        }

        this.keyboardRoot.addEventListener("keydown", e => {
            this.keys.add(e.key.toUpperCase());

            if(this.pointerCurrentlyLocked) {
                if(e.ctrlKey) {
                    if(e.key.toUpperCase() == "W") e.preventDefault();
                    if(e.key.toUpperCase() == "A") e.preventDefault();
                    if(e.key.toUpperCase() == "S") e.preventDefault();
                    if(e.key.toUpperCase() == "D") e.preventDefault();
                    if(e.key.toUpperCase() == " ") e.preventDefault();
                }
            }
        });
        this.keyboardRoot.addEventListener("keyup", e => {
            this.keys.delete(e.key.toUpperCase());
        });
        this.pointerRoot.addEventListener("mousedown", (e) => {
            updatePointer(e);

            if(this.lockPointer && document.pointerLockElement != this.pointerRoot) {
                this.tryPointerLock();
                return;
            }
        });
        this.pointerRoot.addEventListener("mousemove", (e) => {
            updatePointer(e);
        });
        this.pointerRoot.addEventListener("mouseup", (e) => {
            updatePointer(e);
        });

        document.addEventListener("pointerlockchange", () => {
            this.pointerCurrentlyLocked = document.pointerLockElement == this.pointerRoot;
        })
    }

    public resetPointerMovement() {
        this.pointerMovement.x = 0;
        this.pointerMovement.y = 0;
    }

    public setPointerLocked(locked: boolean) {
        this.lockPointer = locked;

        if(!locked && document.pointerLockElement == this.pointerRoot) {
            if(capabilities.REQUEST_POINTER_LOCK) document.exitPointerLock();
        } else if(locked) {
            this.tryPointerLock();
        }
    }

    private tryPointerLock() {
        if(!capabilities.REQUEST_POINTER_LOCK) return;

        this.pointerRoot.requestPointerLock().catch(() => {});
    }

    public keyDown(key: string) {
        return this.keys.has(key.toUpperCase());
    }
}