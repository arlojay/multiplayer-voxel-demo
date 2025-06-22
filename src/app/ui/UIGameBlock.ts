import { BlockStateSaveKey } from "../block/blockState";
import { DisplayBlockRenderer } from "./displayBlockRenderer";
import { SerializedUIElement, UIElement, UIElementRegistry, UIEvent } from "./UIElement";

export interface SerializedUIGameBlock extends SerializedUIElement {
    state: BlockStateSaveKey;
}
export class UIGameBlock extends UIElement<SerializedUIGameBlock> {
    public static setDisplayBlockRenderer(renderer: DisplayBlockRenderer) {
        this.displayBlockRenderer = renderer;
    };
    protected static displayBlockRenderer: DisplayBlockRenderer;
    public static readonly type = UIElementRegistry.register("game-block", this);
    public readonly type = UIGameBlock.type;

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
        ctx.putImageData(UIGameBlock.displayBlockRenderer.getImage(this.state), 0, 0);

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
    
    public serialize() {
        const data = super.serialize();
        data.state = this.state;
        return data;
    }
    public deserialize(data: SerializedUIGameBlock): void {
        super.deserialize(data);
        this.state = data.state;
    }
    public async setRenderBlock(state: BlockStateSaveKey) {
        this.state = state;
        await this.update();
    }
}