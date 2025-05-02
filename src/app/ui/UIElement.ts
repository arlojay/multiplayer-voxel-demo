import { HAS_DOCUMENT_ACCESS, UIContainer } from ".";
import { UIEventBinder } from "./UIEventBinder";

export interface SerializedUIElement {
    type: string;
    style: Partial<CSSStyleDeclaration>;
}

class UIElementRegistryKey {
    name: string;
}

export class UIEvent {
    public name: string;
    public cancelled = false;
    public data?: any;

    constructor(name: string, data?: any) {
        this.name = name;
        this.data = data;
    }
    public cancel() {
        this.cancelled = true;
    }
}

export abstract class UIElement<SerializedData extends SerializedUIElement = SerializedUIElement> {
    private static registry: Map<string, () => UIElement> = new Map;
    public static register(id: string, factory: () => UIElement): UIElementRegistryKey {
        if(this.registry.has(id)) throw new ReferenceError("UI element " + id + " is already registered");
        this.registry.set(id, factory);
        const key = new UIElementRegistryKey;
        key.name = id;
        return key;
    }

    public static deserialize(data: SerializedUIElement) {
        const factory = this.registry.get(data.type);
        if(factory == null) throw new ReferenceError("UI element " + data.type + " is not registered");

        const element = factory();
        element.deserialize(data);
        return element;
    }


    public abstract type: UIElementRegistryKey;
    public element: HTMLElement;
    public style: CSSStyleDeclaration = {} as CSSStyleDeclaration;
    public parent: UIContainer;
    protected eventBinder: UIEventBinder = new UIEventBinder;
    private externalEventHandlers: Map<string, (data?: any) => boolean | void> = new Map;

    protected abstract buildElement(): Promise<HTMLElement>;



    public async update() {
        if(HAS_DOCUMENT_ACCESS) {
            const element = await this.buildElement();
            if(element == null) throw new ReferenceError("Built element must not be null");
            
            if(this.element != null) this.element.replaceWith(element);
            this.eventBinder.setElement(element);
            this.element = element;
            
            for(const prop in this.style) {
                element.style[prop] = this.style[prop];
            }
        }

        return this.element;
    }

    public serialize(): SerializedData {
        return {
            type: this.type.name,
            style: this.style
        } as any; // 🤫
    }
    public deserialize(data: SerializedData) {
        Object.assign(this.style, data.style);
    }
    public handleEvent(event: UIEvent) {
        if(this.externalEventHandlers.get(event.name)?.(event.data)) return;
        this.parent?.handleEvent(event);
    }
    public setEventHandler(event: string, handler: (data?: any) => boolean | void) {
        this.externalEventHandlers.set(event, handler);
    }
    public getPathFrom(root: UIContainer) {
        const path: number[] = [];
        let element: UIElement = this;

        while(element.parent != null) {
            const index = element.parent.getIndexOfChild(element);
            if(index == -1) {
                console.warn("Strangely detached element found while searching", element);
                return null;
            }
            path.push(index);
            if(element.parent == root) return path.reverse();

            element = element.parent;
        }
        
        return null;
    }
}