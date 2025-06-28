import { BinaryBuffer } from "../serialization/binaryBuffer";
import { UIContainer } from "./UIContainer";
import { UIElement, UIElementRegistry } from "./UIElement";

class UILegend extends UIElement {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UILegend.id;

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
    public serialize(bin: BinaryBuffer) {
        super.serialize(bin);
        bin.write_string(this.text);
    }
    public deserialize(bin: BinaryBuffer) {
        super.deserialize(bin);
        this.text = bin.read_string();
    }
    protected getOwnExpectedSize(): number {
        return super.getOwnExpectedSize() + BinaryBuffer.stringByteCount(this.text);
    }
    public async setText(text: string) {
        this.text = text;
        await this.update();
    }
}

export class UIFieldset extends UIContainer {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UIFieldset.id;

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