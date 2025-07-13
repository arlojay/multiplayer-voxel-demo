import { BufferGeometry, Color, Mesh } from "three";
import { attribute, cameraProjectionMatrix, Fn, mix, modelViewMatrix, positionGeometry, texture, uint, vec4 } from "three/src/nodes/TSL";
import { MeshBasicNodeMaterial } from "three/src/Three.WebGPU";
import { TextGeometryBuilder } from "../text/textGeometryBuilder";
import { TextGlyphAtlas } from "../text/textGlyphAtlas";

export class ColorRGBA {
    public readonly color: Color;
    public alpha: number;

    constructor(color = new Color, alpha = 255) {
        this.color = color;
        this.alpha = alpha;
    }

    public get r() {
        return this.color.r * 255;
    }
    public set r(r: number) {
        this.color.r = r / 255;
    }
    public get g() {
        return this.color.g * 255;
    }
    public set g(g: number) {
        this.color.g = g / 255;
    }
    public get b() {
        return this.color.b * 255;
    }
    public set b(b: number) {
        this.color.b = b / 255;
    }
    public get a() {
        return this.alpha;
    }
    public set a(a: number) {
        this.alpha = a;
    }
    
    public set(r: number, g: number, b: number, a: number) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    public copy(color: ColorRGBA) {
        this.r = color.r;
        this.g = color.g;
        this.b = color.b;
        this.a = color.a;
    }

    public getHexString() {
        return this.color.getHexString() + this.alpha.toString(16).padStart(2, "0").slice(0, 2);
    }
}

const atlas = new TextGlyphAtlas("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()`~-_=+[]{}<>,./?\\| ", "64px Arial, sans-serif");
atlas.build();
const builder = new TextGeometryBuilder(atlas);

const material = new MeshBasicNodeMaterial({
    color: 0xffffff,
    transparent: true
});
material.vertexNode = Fn((builder) => {
    const aspect = cameraProjectionMatrix
        .element(uint(1))
        .element(uint(1))
        .div(
            cameraProjectionMatrix.element(uint(0))
            .element(uint(0))
        );
    return cameraProjectionMatrix.mul(modelViewMatrix)
    .mul(vec4(0, 0, 0, 1))
    .add(vec4(positionGeometry, 0).div(vec4(aspect, 1, 1, 1)));
})();
material.colorNode = Fn(() => {
    const backgroundColor = attribute("backgroundColor", "vec4");
    const textColor = attribute("textColor", "vec4");
    
    return mix(
        vec4(
            backgroundColor.r.toFloat(),
            backgroundColor.g.toFloat(),
            backgroundColor.b.toFloat(),
            backgroundColor.a.toFloat()
        ).div(255),
        vec4(
            textColor.r.toFloat(),
            textColor.g.toFloat(),
            textColor.b.toFloat(),
            textColor.a.toFloat()
        ).div(255),
        texture(atlas.texture).a
    );
})();

export class FloatingText {
    private _text: string;
    public readonly mesh: Mesh;
    private _size = 0.25;

    private readonly _background = new ColorRGBA(new Color(0x000000), 0x88);
    private readonly _color = new ColorRGBA(new Color(0xffffff), 0xff);
    public needsUpdate = false;

    public constructor(text: string) {
        this._text = text;
        this.mesh = new Mesh(
            new BufferGeometry(),
            material
        );
        this.mesh.onBeforeRender = () => {
            if(this.needsUpdate) this.update();
        }
        this.update();
    }
    public dispose() {
        this.mesh.geometry.dispose();
    }
    public update() {
        const geometry = builder.create(this._text, this._color, this._background);
        geometry.computeBoundingBox();
        geometry.translate(geometry.boundingBox.max.x * -0.5, geometry.boundingBox.max.y * -0.5, 0);
        geometry.scale(this._size, this._size, this._size);

        this.mesh.geometry.dispose();
        this.mesh.geometry = geometry;
        
        this.needsUpdate = false;
    }
    public set text(text: string) {
        if(this._text != text) {
            this._text = text;
            this.needsUpdate = true;
        }
    }
    public get text() {
        return this._text;
    }
    public set size(size: number) {
        if(this._size != size) {
            this._size = size;
            this.needsUpdate = true;
        }
    }
    public get size() {
        return this._size;
    }
    public set color(color: ColorRGBA) {
        if(color.r != this._color.r || color.g != this._color.g || color.b != this._color.b || color.a != this._color.a) {
            this._color.copy(color);
            this.needsUpdate = true;
        }
    }
    public get color() {
        return this._color;
    }
    public set background(color: ColorRGBA) {
        if(color.r != this._background.r || color.g != this._background.g || color.b != this._background.b || color.a != this._background.a) {
            this._background.copy(color);
            this.needsUpdate = true;
        }
    }
    public get background() {
        return this._background;
    }
}