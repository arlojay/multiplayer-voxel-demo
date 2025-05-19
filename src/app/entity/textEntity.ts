import { ColorRGBA, FloatingText } from "../floatingText";
import { LocalEntity } from "./localEntity";
import { RemoteEntity } from "./remoteEntity";

export interface TextEntityBase {
    text: string;
    color: ColorRGBA;
    background: ColorRGBA;
}

export class RemoteTextEntity extends RemoteEntity implements TextEntityBase {
    public text = "";
    public color: ColorRGBA;
    public background: ColorRGBA;
    public model: FloatingText;

    public get mesh() {
        return this.model.mesh;
    }

    public init() {
        this.model = new FloatingText(this.text);
        this.color = this.model.color;
        this.background = this.model.background;
    }
    public dispose() {
        this.model.dispose();
    }
    public update(dt: number): void {
        super.update(dt);

        this.model.text = this.text;
        this.model.color = this.color;
    }
}
export class TextEntity extends LocalEntity implements TextEntityBase {
    public text = "";
    public color: ColorRGBA;
    public background: ColorRGBA;

    public init() {
        
    }
}