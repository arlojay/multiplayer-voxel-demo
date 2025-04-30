import { UIElement } from "./UIElement";

export class UIEventBinder {
    private events: Map<string, (event?: Event) => void> = new Map;
    private element: HTMLElement;

    public on(name: string, callback: () => void) {
        const newCallback = (event?: Event) => {
            event?.preventDefault();
            callback();
        };

        const oldCallback = this.events.get(name);
        this.events.set(name, newCallback);

        if(this.element != null) {
            this.element.removeEventListener("change", oldCallback);
            this.element.addEventListener("change", newCallback);
        }
    }

    public setElement(element: HTMLElement) {
        for(const [name, handler] of this.events) {
            this.element?.removeEventListener(name, handler);
            element.addEventListener(name, handler);
        }

        this.element = element;
    }
    public call(name: string, event?: Event) {
        this.events.get(name)?.(event);
    }
}