import { HAS_DOCUMENT_ACCESS } from ".";

export interface SerializedUIElement {
    type: string;
    style: Partial<CSSStyleDeclaration>;
}

class UIElementRegistryKey {
    name: string;
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
        console.log(data);

        const element = factory();
        element.deserialize(data);
        return element;
    }


    public abstract type: UIElementRegistryKey;
    public element: HTMLElement;
    public style: CSSStyleDeclaration = {} as CSSStyleDeclaration;

    protected abstract buildElement(): Promise<HTMLElement>;
    protected cleanupElement(element: HTMLElement) {

    }



    public async update() {
        if(HAS_DOCUMENT_ACCESS) {
            if(this.element != null) {
                this.cleanupElement(this.element);
            }
            const element = await this.buildElement();
            if(element == null) throw new ReferenceError("Built element must not be null");
            
            if(this.element != null) this.element.replaceWith(element);
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
}