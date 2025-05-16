import { BufferGeometry, Color, Mesh, MeshBasicMaterial, NearestFilter, PlaneGeometry, RGB, Texture } from "three";
import { Fn, modelPosition, modelViewPosition, modelViewProjection, positionLocal, positionWorld, uniform } from "three/src/nodes/TSL";
import { MeshBasicNodeMaterial } from "three/src/Three.WebGPU";

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
    public resolution = 1;
    private material: MeshBasicNodeMaterial;
    private textImage: Texture;

    public background = new Color(0x000000);
    public backgroundAlpha = 0x88;
    public color = new Color(0xffffff);
    public colorAlpha = 0xff;

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
            return modelPosition.add(positionLocal);
        })();
        this.update();
    }
    private createTexture() {
        return createTextImage(
            this._text,
            this.resolution * 32,
            this.background.getHexString() + this.backgroundAlpha.toString(16).padStart(2, "0").slice(0, 2),
            this.color.getHexString() + this.colorAlpha.toString(16).padStart(2, "0").slice(0, 2)
        );
    }
    public update() {
        const text = this.createTexture();

        this.mesh.geometry.dispose();
        this.mesh.geometry = new PlaneGeometry(text.aspect * this.resolution * 0.1, this.resolution * 0.1);
        console.log(text.texture);
        this.material.map = text.texture;
        this.material.map.dispose();
        this.material.map.needsUpdate = true;
    }
    public set text(text: string) {
        this._text = text;
        this.update();
    }
    public get text() {
        return this._text;
    }
}