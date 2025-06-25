import { Euler, Object3D, SkinnedMesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { attribute, color, dot, mix, uniform } from "three/src/nodes/TSL";
import { Color, MeshBasicNodeMaterial, Vector3 } from "three/src/Three.WebGPU";
import { dlerp } from "../math";
import { sunPos } from "../shaders/sky";
import { FloatingText } from "./floatingText";

const loader = new GLTFLoader();

export class PlayerModel {
    public username = "anonymous";
    public color = "ffffff";

    public readonly position = new Vector3;
    public yaw: number = Math.PI * 0.25;
    public pitch: number = 0;

    private readonly colorNode = new Color("#" + this.color);
    private readonly nametag = new FloatingText(this.username);
    public readonly mesh: Object3D = new Object3D;
    public skin: SkinnedMesh;

    public constructor() {
        this.createModel();
        this.nametag.size = 1/3;
    }

    public async createModel() {
        const player = await loader.loadAsync("assets/models/player.glb");;
        const object = player.scene.children[0];
        this.skin = object.children[0] as SkinnedMesh;
        
        this.mesh.add(object);

        const nametagMesh = this.nametag.mesh;
        nametagMesh.position.set(0, 2.2, 0);
        this.mesh.add(nametagMesh);


        const material = new MeshBasicNodeMaterial();
        this.skin.material = material;

        
        material.colorNode = mix(
            color(0, 0, 0),
            uniform(this.colorNode),
            dot(attribute("normal", "vec3f"), sunPos).mul(0.5).add(0.5)
        );
    }

    public dispose() {
        this.skin.skeleton.dispose();
    }

    public update(dt: number): void {
        this.colorNode.copy(new Color("#" + this.color));
        this.nametag.text = this.username;

        if(this.mesh != null) {
            this.mesh.position.copy(this.position);
            this.mesh.rotation.y = -dlerp(-this.mesh.rotation.y, this.yaw, dt, 24);
        }

        if(this.skin != null) {
            this.skin.skeleton.bones[1].setRotationFromEuler(new Euler(-this.pitch, 0, 0));
        }
    }
}