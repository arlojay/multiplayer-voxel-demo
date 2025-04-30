import { SerializedUIElement, UIElement } from "./UIElement";

export interface SerializedUIContainer extends SerializedUIElement {
    elements: SerializedUIElement[];
}
export abstract class UIContainer<SerializedData extends SerializedUIContainer = SerializedUIContainer> extends UIElement<SerializedData> {
    public elements: Set<UIElement> = new Set;

    protected async appendContainerElements(element: HTMLElement) {
        const builtElements = await Promise.all(this.elements.values().map(v => v.update()));
        element.append(...builtElements);
    }

    public async addElement(element: UIElement) {
        this.elements.add(element);
        element.parent = this;
        await this.update();
    }
    public async removeElement(element: UIElement) {
        this.elements.delete(element);
        element.parent = null;
        await this.update();
    }

    public serialize() {
        const data = super.serialize();
        data.elements = this.elements.values().map(el => el.serialize()).toArray();
        return data;
    }
    public deserialize(data: SerializedData): void {
        super.deserialize(data);
        this.elements.clear();

        for(const element of data.elements) {
            this.elements.add(UIElement.deserialize(element));
        }
    }
    public getElement(index: number) {
        return this.elements.values().find((_, i) => i == index);
    }
    public getPathOfElement(locatingElement: UIElement): number[] {
        let i = 0;
        for(const element of this.elements) {
            if(element == locatingElement) {
                return [i];
            }
            if(element instanceof UIContainer) {
                const subResult = element.getPathOfElement(locatingElement);
                if(subResult != null) return [i, ...subResult];
            }
            i++;
        }
    }
    public getElementByPath(path: number[]): UIElement | null {
        if(path.length == 0) return this;


        path = Array.from(path); // clone path array
        const element = this.getElement(path.shift());

        if(path.length == 0) return element;
        if(element == null) return null;

        if(element instanceof UIContainer) {
            return element.getElementByPath(path);
        }
    }
    public getAllElements() {
        const elements: Set<UIElement> = new Set;
        for(const element of this.elements) {
            elements.add(element);
            if(element instanceof UIContainer) {
                for(const subElement of element.getAllElements()) {
                    elements.add(subElement);
                }
            }
        }
        return elements;
    }
    public getAllElementsOfType<T extends UIElement>(type: new (...args: any[]) => T) {
        const elements: Set<T> = new Set;
        for(const element of this.elements) {
            if(element instanceof type) {
                elements.add(element as T);
            }
            if(element instanceof UIContainer) {
                for(const subElement of element.getAllElementsOfType<T>(type)) {
                    elements.add(subElement);
                }
            }
        }
        return elements;
    }
}