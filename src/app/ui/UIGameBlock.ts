import { BlockStateSaveKey } from "../block/blockState";
import { BinaryBuffer } from "../serialization/binaryBuffer";
import { DisplayBlockRenderer } from "./displayBlockRenderer";
import { UIElement, UIElementRegistry, UIEvent } from "./UIElement";

export class UIGameBlock extends UIElement {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UIGameBlock.id;

    public state: BlockStateSaveKey;

    public constructor(text?: BlockStateSaveKey) {
        super();
        if(text != null) this.state = text;
    }

    protected async buildElement() {
        const element = document.createElement("canvas");
        element.width = 64;
        element.height = 64;
        element.style.width = element.width / devicePixelRatio + "px";
        element.style.height = element.height / devicePixelRatio + "px";

        const ctx = element.getContext("2d");
        ctx.putImageData(DisplayBlockRenderer.instance.getImage(this.state), 0, 0);

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
    public async setRenderBlock(state: BlockStateSaveKey) {
        this.state = state;
        await this.update();
    }
    
    public serialize(bin: BinaryBuffer) {
        super.serialize(bin);
        bin.write_string(this.state);
    }
    public deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.state = bin.read_string() as BlockStateSaveKey;
    }
    protected getOwnExpectedSize(): number {
        return super.getOwnExpectedSize() + BinaryBuffer.stringByteCount(this.state);
    }
}