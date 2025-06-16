import { UIContainer } from "./UIContainer";
import { UIElement, UIElementRegistry } from "./UIElement";
import { UIForm } from "./UIForm";

export class UIFieldset extends UIContainer {
    public static readonly type = UIElementRegistry.register("fldt", this);
    public readonly type = UIForm.type;

    public legend: string;
    public constructor(legend?: string) {
        super();
        if(legend != null) this.legend = legend;
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("fieldset");

        const legend = document.createElement("legend");
        legend.textContent = this.legend;
        element.appendChild(legend);

        await this.appendContainerElements(element);

        return element;
    }
}