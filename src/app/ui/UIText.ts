import { SerializedUIElement, UIElement } from "./UIElement";

export interface SerializedUIText extends SerializedUIElement {
    text: string;
}
export class UIText extends UIElement<SerializedUIText> {
    public static readonly type = UIElement.register("txt", () => new this);
    public readonly type = UIText.type;

    public text: string = "";

    public constructor(text?: string) {
        super();
        if(text != null) this.text = text;
    }

    protected async buildElement(): Promise<HTMLElement> {
        if(this.element == null) {
            const element = document.createElement("span");
            element.textContent = this.text;

            return element;
        }
        
        this.element.textContent = this.text;
        return this.element;
    }
    public serialize() {
        const data = super.serialize();
        data.text = this.text;
        return data;
    }
    public deserialize(data: SerializedUIText): void {
        super.deserialize(data);
        this.text = data.text;
    }
    public async setText(text: string) {
        this.text = text;
        await this.update();
    }
}