import { BinaryBuffer, F32, U8 } from "src/app/binary";
import { ColorRGBA, FloatingText } from "../../floatingText";
import { BaseEntity, entityRegistry } from "../baseEntity";
import { LocalEntity } from "../localEntity";
import { RemoteEntity } from "../remoteEntity";

export class TextEntity extends BaseEntity<RemoteTextEntity, LocalTextEntity> {
    public static readonly id = entityRegistry.register(this);
    public readonly id = TextEntity.id;

    public text: string;
    public color: ColorRGBA = new ColorRGBA;
    public background: ColorRGBA = new ColorRGBA;

    protected init(): void {
        
    }

    protected instanceLogic(local: boolean) {
        return local ? new RemoteTextEntity(this) : new LocalTextEntity(this);
    }
    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.text);
        bin.write_f32(this.color.r); bin.write_f32(this.color.g); bin.write_f32(this.color.b); bin.write_f32(this.color.a);
        bin.write_f32(this.background.r); bin.write_f32(this.background.g); bin.write_f32(this.background.b); bin.write_f32(this.background.a);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.text = bin.read_string();
        this.color.set(bin.read_f32(), bin.read_f32(), bin.read_f32(), bin.read_f32());
        this.background.set(bin.read_f32(), bin.read_f32(), bin.read_f32(), bin.read_f32());
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.text) +
            F32 * 4 +
            F32 * 4
        );
    }
}

export class RemoteTextEntity extends RemoteEntity<TextEntity> {
    public model: FloatingText;

    public get mesh() {
        return this.model.mesh;
    }

    public init() {
        this.model = new FloatingText(this.base.text);
    }
    public dispose() {
        this.model.dispose();
    }
    public update(dt: number): void {
        super.update(dt);

        this.model.text = this.base.text;
        this.model.color = this.base.color;
    }
}
export class LocalTextEntity extends LocalEntity<TextEntity> {
    
}