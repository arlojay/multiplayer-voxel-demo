import { BufferGeometry, Color, Mesh, NearestFilter, PlaneGeometry, Texture } from "three";
import { cameraProjectionMatrix, Fn, modelViewMatrix, positionGeometry, vec4 } from "three/src/nodes/TSL";
import { MeshBasicNodeMaterial } from "three/src/Three.WebGPU";

export class ColorRGBA {
    public color: Color;
    public alpha: number;

    constructor(color = new Color, alpha = 1) {
        this.color = color;
        this.alpha = alpha;
    }

    public get r() {
        return this.color.r;
    }
    public set r(r: number) {
        this.color.r = r;
    }
    public get g() {
        return this.color.g;
    }
    public set g(g: number) {
        this.color.g = g;
    }
    public get b() {
        return this.color.b;
    }
    public set b(b: number) {
        this.color.b = b;
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

    public getHexString() {
        return this.color.getHexString() + this.alpha.toString(16).padStart(2, "0").slice(0, 2);
    }
}

function createTextImage(text: string, fontSize: number, backgroudColor: string, textColor: string) {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    const font = fontSize + "px sans-serif";

    ctx.font = font;
    const measurement = ctx.measureText(text);

    canvas.width = Math.ceil(measurement.actualBoundingBoxRight - measurement.actualBoundingBoxLeft);
    canvas.height = Math.ceil(measurement.actualBoundingBoxAscent + measurement.actualBoundingBoxDescent);
    ctx.font = font;


    ctx.fillStyle = "#" + backgroudColor;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#" + textColor;
    ctx.fillText(text, -measurement.actualBoundingBoxLeft, measurement.actualBoundingBoxAscent);

    const texture = new Texture(canvas);
    texture.magFilter = NearestFilter;
    return { aspect: canvas.width / canvas.height, texture };
}

export class FloatingText {
    private _text: string;
    public mesh: Mesh;
    public resolution = 320;
    public size = 0.1;
    private material: MeshBasicNodeMaterial;

    public background = new ColorRGBA(new Color(0x000000), 0x88);
    public color = new ColorRGBA(new Color(0xffffff), 0xff);

    public constructor(text: string) {
        this._text = text;
        this.mesh = new Mesh(
            new BufferGeometry(),
            this.material = new MeshBasicNodeMaterial({
                color: 0xffffff,
                map: this.createTexture().texture,
                transparent: true
            })
        );
        this.material.vertexNode = Fn(() => {
            const aspect = cameraProjectionMatrix.element(1).element(1).div(cameraProjectionMatrix.element(0).element(0));
            return cameraProjectionMatrix.mul(modelViewMatrix)
            .mul(vec4(0, 0, 0, 1))
            .add(vec4(positionGeometry, 0).div(vec4(aspect, 1, 1, 1)));
        })();
        this.update();
    }
    public dispose() {
        this.material.dispose();
        this.mesh.geometry.dispose();
    }
    private createTexture() {
        return createTextImage(
            this._text,
            this.resolution * this.size,
            this.background.getHexString(),
            this.color.getHexString(),
        );
    }
    public update() {
        const text = this.createTexture();

        this.mesh.geometry.dispose();
        this.mesh.geometry = new PlaneGeometry(text.aspect * this.size, this.size);
        this.material.map = text.texture;
        this.material.map.dispose();
        this.material.map.needsUpdate = true;
    }
    public set text(text: string) {
        if(this._text != text) {
            this._text = text;
            this.update();
        }
    }
    public get text() {
        return this._text;
    }
}