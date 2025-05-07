import { UIContainer } from "./UIContainer";
import { UIElement } from "./UIElement";
import { UIForm } from "./UIForm";

export class UIFieldset extends UIContainer {
    public static type = UIElement.register("fldt", () => new this);
    public type = UIForm.type;

    public legend: string;

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("fieldset");

        const legend = document.createElement("legend");
        legend.textContent = this.legend;
        element.appendChild(legend);

        this.appendContainerElements(element);

        return element;
    }
}