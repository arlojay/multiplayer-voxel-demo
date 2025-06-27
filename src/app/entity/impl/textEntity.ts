import { Color, Scene } from "three";
import { ColorRGBA, FloatingText } from "../../client/floatingText";
import { BinaryBuffer, F32, U8 } from "../../serialization/binaryBuffer";
import { BaseEntity, entityRegistry } from "../baseEntity";
import { LocalEntity } from "../localEntity";
import { RemoteEntity } from "../remoteEntity";
import { TimeMetric } from "../../client/updateMetric";

export class TextEntity extends BaseEntity<RemoteTextEntity, LocalTextEntity> {
    public static readonly id = entityRegistry.register(this);
    public readonly id = TextEntity.id;

    public text = "";
    public color: ColorRGBA = new ColorRGBA(new Color(0xffffff), 0xff);
    public background: ColorRGBA = new ColorRGBA(new Color(0x000000), 0x88);
    public size = 0.25;

    protected instanceLogic(local: boolean) {
        return local ? new LocalTextEntity(this) : new RemoteTextEntity(this);
    }
    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.text);
        bin.write_u8(this.color.r); bin.write_u8(this.color.g); bin.write_u8(this.color.b); bin.write_u8(this.color.a);
        bin.write_u8(this.background.r); bin.write_u8(this.background.g); bin.write_u8(this.background.b); bin.write_u8(this.background.a);
        bin.write_f32(this.size);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.text = bin.read_string();
        this.color.set(bin.read_u8(), bin.read_u8(), bin.read_u8(), bin.read_u8());
        this.background.set(bin.read_u8(), bin.read_u8(), bin.read_u8(), bin.read_u8());
        this.size = bin.read_f32();
    }
    protected getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.text) +
            U8 * 4 +
            U8 * 4 +
            F32
        );
    }
}

export class RemoteTextEntity extends RemoteEntity<TextEntity> {
    public readonly model = new FloatingText("");

    public get mesh() {
        return this.model.mesh;
    }

    public dispose() {
        this.model.dispose();
    }
    public update(metric: TimeMetric): void {
        super.update(metric);
        
        this.model.mesh.position.copy(this.renderPosition);
    }
    
    public onUpdated(): void {
        this.model.color = this.base.color;
        this.model.background = this.base.background;
        this.model.text = this.base.text;
        this.model.size = this.base.size;
    }
    public onAdd(scene: Scene): void {
        scene.add(this.model.mesh);
        this.onUpdated();
    }
    public onRemove(): void {
        this.model.mesh.removeFromParent();
        this.model.dispose();
    }
}
export class LocalTextEntity extends LocalEntity<TextEntity> {
    protected ignoreGravity = true;
}