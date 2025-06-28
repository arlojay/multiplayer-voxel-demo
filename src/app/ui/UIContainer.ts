import { BinaryBuffer, U16 } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry, UIEvent } from "./UIElement";

export abstract class UIContainer extends UIElement {
    public elements: UIElement[] = new Array;

    protected async appendContainerElements(element: HTMLElement) {
        if(!this.visible) return;
        const builtElements = await Promise.all(this.elements.values().filter(v => v.visible).map(v => v.update()));
        element.append(...builtElements);
    }

    public async addChild(element: UIElement, index: number = this.elements.length) {
        const removedElements = this.elements.splice(index);
        this.elements.push(element);
        for(const removedElement of removedElements) this.elements.push(removedElement);

        element.parent = this;
        this.bubbleEvent(new UIEvent("addElement", this, element));

        if(this.element != null) await this.update();
    }
    public async addElementAtPath(path: number[], element: UIElement): Promise<boolean> {
        path = Array.from(path);
        const parent = this.getElementByPath(path.splice(0, path.length - 1));
        
        if(parent instanceof UIContainer) {
            await parent.addChild(element, path.pop());
            return true;
        }
        return false;
    }
    public async removeChild(element: UIElement): Promise<boolean> {
        const index = this.elements.indexOf(element);
        if(index == -1) return false;

        this.elements.splice(index, 1);

        this.bubbleEvent(new UIEvent("removeElement", this, element));
        element.parent = null;

        if(this.element != null) await this.update();

        return true;
    }
    public async removeElementByPath(path: number[]): Promise<UIElement> {
        path = Array.from(path);
        const index = path.shift();

        if(path.length == 0) {
            const element = this.elements[index];
            return await this.removeChild(element) ? element : null;
        }
        
        const element = this.elements[index];
        if(element instanceof UIContainer) {
            return await element.removeElementByPath(path);
        }
        return null;
    }
    public getIndexOfChild(child: UIElement) {
        return this.elements.indexOf(child);
    }

    public serialize(bin: BinaryBuffer) {
        super.serialize(bin);
        bin.write_u16(this.elements.length);
        for(const element of this.elements) {
            element.write(bin);
        }
    }
    public deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.elements.splice(0);

        const elementCount = bin.read_u16();
        for(let i = 0; i < elementCount; i++) {
            const element = UIElementRegistry.createFromBinary(bin);
            element.parent = this;
            this.elements.push(element);
        }
    }
    protected getOwnExpectedSize(): number {
        return super.getOwnExpectedSize() + (
            U16 +
            this.elements.reduce((size, element) => size + element.getExpectedSize(), 0)
        );
    }
    public getElement(index: number) {
        return this.elements.values().find((_, i) => i == index);
    }
    public getPathOfElement(locatingElement: UIElement): number[] {
        return locatingElement.getPathFrom(this);
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
    public percolateEvent(event: UIEvent) {
        super.percolateEvent(event);
        for(const element of this.elements) {
            element.percolateEvent(event);
        }
    }

    public destroy() {
        for(const element of this.elements) {
            element.destroy();
        }
        super.destroy();
    }
}