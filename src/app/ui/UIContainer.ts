import { SerializedUIElement, UIElement } from "./UIElement";

export interface SerializedUIContainer extends SerializedUIElement {
    elements: SerializedUIElement[];
}
export class UIContainer extends UIElement<SerializedUIContainer> {
    public static type = UIElement.register("cntr", () => new this);
    public type = UIContainer.type;

    public elements: Set<UIElement> = new Set;

    async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");

        console.log(this.elements);
        if(this.elements == null) {
            console.trace(this.elements);
        }
        const builtElements = await Promise.all(this.elements.values().map(v => v.update()));
        element.append(...builtElements);

        return element;
    }

    public async addElement(element: UIElement) {
        this.elements.add(element);
        await this.update();
    }
    public async removeElement(element: UIElement) {
        this.elements.delete(element);
        await this.update();
    }

    public serialize() {
        const data = super.serialize();
        data.elements = this.elements.values().map(el => el.serialize()).toArray();
        return data;
    }
    public deserialize(data: SerializedUIContainer): void {
        super.deserialize(data);
        this.elements.clear();

        for(const element of data.elements) {
            this.elements.add(UIElement.deserialize(element));
        }
    }
}