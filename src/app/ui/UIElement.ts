import { HAS_DOCUMENT_ACCESS, UIContainer } from ".";
import { HashedFactoryRegistry, HashedRegistryKey } from "../registry";
import { UIEventBinder } from "./UIEventBinder";

export interface SerializedUIElement {
    type: string;
    visible: boolean;
    style: Partial<CSSStyleDeclaration>;
}

export class UIEvent {
    public name: string;
    public cancelled = false;
    public data?: any;

    constructor(name: string, data?: any) {
        this.name = name;
        this.data = data;
    }
    public preventDefault() {
        this.cancelled = true;
    }
}

export const UIElementRegistry: HashedFactoryRegistry<UIElement, string> = new HashedFactoryRegistry;

export abstract class UIElement<SerializedData extends SerializedUIElement = SerializedUIElement> {
    public static deserialize(data: SerializedUIElement) {
        const ElementClass = UIElementRegistry.getFactory(data.type);
        if(ElementClass == null) throw new ReferenceError("UI element " + data.type + " is not registered");

        const element = new ElementClass;
        element.deserialize(data);
        return element;
    }


    public abstract readonly type: HashedRegistryKey<string>;
    public element: HTMLElement;
    public visible = true;
    public style: CSSStyleDeclaration = {} as CSSStyleDeclaration;
    public parent: UIContainer;
    protected _eventBinder: UIEventBinder;
    private externalEventHandlers: Map<string, (event: UIEvent) => boolean | void> = new Map;

    protected abstract buildElement(): Promise<HTMLElement>;

    protected get eventBinder() {
        return this._eventBinder ??= new UIEventBinder;
    }


    public async update() {
        if(HAS_DOCUMENT_ACCESS) {
            const element = await this.buildElement();
            if(element == null) throw new ReferenceError("Built element must not be null");
            if(!this.visible) element.hidden = true;
            
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
            type: this.type.key,
            style: this.style,
            visible: this.visible
        } as any; // 🤫
    }
    public deserialize(data: SerializedData) {
        Object.assign(this.style, data.style);
    }
    public bubbleEvent(event: UIEvent) {
        if(this.externalEventHandlers.get(event.name)?.(event)) return;
        this.parent?.bubbleEvent(event);
    }
    public percolateEvent(event: UIEvent) {
        this.externalEventHandlers.get(event.name)?.(event);
    }
    public setEventHandler(event: string, handler: (event: UIEvent) => boolean | void) {
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