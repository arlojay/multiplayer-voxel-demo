import { BufferGeometry, Color, Mesh, NearestFilter, PlaneGeometry, Texture } from "three";
import { cameraProjectionMatrix, Fn, modelViewMatrix, positionGeometry, vec4 } from "three/src/nodes/TSL";
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
    public resolution = 320;
    public size = 0.1;
    private material: MeshBasicNodeMaterial;

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
            const aspect = cameraProjectionMatrix.element(1).element(1).div(cameraProjectionMatrix.element(0).element(0));
            return cameraProjectionMatrix.mul(modelViewMatrix)
            .mul(vec4(0, 0, 0, 1))
            .add(vec4(positionGeometry, 0).div(vec4(aspect, 1, 1, 1)));
        })();
        this.update();
    }
    private createTexture() {
        return createTextImage(
            this._text,
            this.resolution * this.size,
            this.background.getHexString() + this.backgroundAlpha.toString(16).padStart(2, "0").slice(0, 2),
            this.color.getHexString() + this.colorAlpha.toString(16).padStart(2, "0").slice(0, 2)
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