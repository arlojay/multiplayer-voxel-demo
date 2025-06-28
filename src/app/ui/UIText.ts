import { BinaryBuffer } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry } from "./UIElement";

export class UIText extends UIElement {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UIText.id;

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
    public async setText(text: string) {
        this.text = text;
        await this.update();
    }

    public serialize(bin: BinaryBuffer) {
        super.serialize(bin);
        bin.write_string(this.text);
    }
    public deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.text = bin.read_string();
    }
    protected getOwnExpectedSize(): number {
        return super.getOwnExpectedSize() + BinaryBuffer.stringByteCount(this.text);
    }
}