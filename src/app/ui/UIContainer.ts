import { UIElement } from "./UIElement";

export class UIContainer extends UIElement {
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
}