import { UIContainer } from "./UIContainer";
import { SerializedUIElement, UIElement, UIElementRegistry } from "./UIElement";

interface SerializedUILegend extends SerializedUIElement {
    text: string;
}
class UILegend extends UIElement<SerializedUILegend> {
    public static readonly type = UIElementRegistry.register("lgnd", this);
    public readonly type = UILegend.type;

    public text: string = "";

    public constructor(text?: string) {
        super();
        if(text != null) this.text = text;
    }
    
    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("legend");
        element.textContent = this.text;

        return element;
    }
    public serialize() {
        const data = super.serialize();
        data.text = this.text;
        return data;
    }
    public deserialize(data: SerializedUILegend): void {
        super.deserialize(data);
        this.text = data.text;
    }
    public async setText(text: string) {
        this.text = text;
        await this.update();
    }
}

export class UIFieldset extends UIContainer {
    public static readonly type = UIElementRegistry.register("fldt", this);
    public readonly type = UIFieldset.type;

    public readonly legend: UIElement;
    public constructor(legend?: string) {
        super();
        if(legend != null) {
            this.addChild(this.legend = new UILegend(legend));
        }
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("fieldset");

        await this.appendContainerElements(element);

        return element;
    }
    public async update() {
        if(this.legend instanceof UIElement) await this.legend.update();
        return await super.update();
    }
}