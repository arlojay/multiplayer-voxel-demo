import { BinaryBuffer } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry, UIEvent } from "./UIElement";

export class UIButton extends UIElement {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UIButton.id;

    public text: string = "";

    public constructor(text?: string) {
        super();
        if(text != null) this.text = text;
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("button");
        element.textContent = this.text;

        return element;
    }

    public click() {
        this.eventBinder.call("click");
    }

    public onClick(callback: () => void) {
        this.eventBinder.on("click", (event?: Event) => {
            event?.preventDefault();

            const trySubmit = new UIEvent("trysubmit", this);
            this.bubbleEvent(trySubmit);
            
            callback();
        })
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
    public async setText(text: string) {
        this.text = text;
        await this.update();
    }
}