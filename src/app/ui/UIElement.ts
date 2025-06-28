import { UIContainer } from ".";
import { capabilities } from "../capability";
import { BinaryBuffer, BOOL } from "../serialization/binaryBuffer";
import { BufferSerializable, BufferSerializableRegistry } from "../serialization/bufferSerializable";
import { UIEventBinder } from "./UIEventBinder";

export class UIEvent {
    public name: string;
    public cancelled = false;
    public data?: any;
    public emitter: UIElement;

    constructor(name: string, emitter: UIElement, data?: any) {
        this.name = name;
        this.emitter = emitter;
        this.data = data;
    }
    public preventDefault() {
        this.cancelled = true;
    }
}

export const UIElementRegistry = new class UIElementRegistry extends BufferSerializableRegistry<UIElement, ConstructorParameters<typeof UIElement>> {

}

export abstract class UIElement extends BufferSerializable {
    public element: HTMLElement;
    public visible = true;
    public style: CSSStyleDeclaration = {} as CSSStyleDeclaration;
    public parent: UIContainer;
    protected _eventBinder: UIEventBinder;
    private externalEventHandlers: Map<string, (event: UIEvent) => boolean | void> = new Map;
    private onUpdateCallback: () => void;
    private onDestroyedCallback: () => void;

    protected abstract buildElement(): Promise<HTMLElement>;

    protected get eventBinder() {
        return this._eventBinder ??= new UIEventBinder;
    }

    public async hide() {
        if(!this.visible) return;
        
        this.visible = false;
        await this.update();
    }

    public async show() {
        if(this.visible) return;
        
        this.visible = true;
        await this.update();
    }

    public async update() {
        if(capabilities.DOCUMENT) {
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

        this.bubbleEvent(new UIEvent("updateElement", this));
        this.onUpdateCallback?.();

        return this.element;
    }
    public onUpdate(callback: () => void) {
        this.onUpdateCallback = callback;
    }
    public onDestroyed(callback: () => void) {
        this.onDestroyedCallback = callback;
    }

    public destroy() {
        this.onDestroyedCallback?.();
        this.parent = null;
        this.style = null;
        this.element = null;
        this.externalEventHandlers.clear();
        this.externalEventHandlers = null;
        this._eventBinder = null;
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

    public serialize(bin: BinaryBuffer) {
        bin.write_json(this.style);
        bin.write_boolean(this.visible);
    }
    public deserialize(bin: BinaryBuffer) {
        Object.assign(this.style, bin.read_json());
        this.visible = bin.read_boolean();
    }
    protected getOwnExpectedSize(): number {
        return BinaryBuffer.jsonByteCount(this.style) + BOOL;
    }
}