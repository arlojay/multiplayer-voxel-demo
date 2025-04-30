import { Box3, BoxGeometry, Euler, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Skeleton, SkinnedMesh, TextureLoader, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { RemoteEntity } from "../entity/remoteEntity";
import { dlerp } from "../math";
import { Color, MeshBasicNodeMaterial } from "three/src/Three.WebGPU";
import { attribute, dot, vec3, vec4 } from "three/src/nodes/TSL";
import { sunPos } from "../shaders/terrain";

// const playerFace = new TextureLoader().load("assets/textures/player-face.png");
const loader = new GLTFLoader();

export const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
    }
    return (hash >>> 0);
}

export class RemotePlayer extends RemoteEntity {
    public hitbox: Box3 = new Box3(
        new Vector3(-0.3, 0, -0.3),
        new Vector3(0.3, 1.8, 0.3)
    );
    public yaw: number = Math.PI * 0.25;
    public pitch: number = 0;

    public mesh: Object3D = new Object3D;
    public id: string;
    public skin: SkinnedMesh;
    public username = "anonymous";
    public color = "#ffffff";

    public constructor(id: string) {
        super();
        this.id = id;
    }

    public async createModel() {
        const player = await loader.loadAsync("assets/models/player.glb");;
        const object = player.scene.children[0];
        this.skin = object.children[0] as SkinnedMesh;
        
        this.mesh.add(object);

        const color = new Color(this.color);


        const material = new MeshBasicNodeMaterial();
        this.skin.material = material;

        
        // material.colorNode = vec4(vec3(...color).mul(dot(attribute("objectNormal", "mat3x3<f32>").mul(attribute("normal", "vec3f")), sunPos)), 1);
        material.colorNode = vec4(vec3(...color).mul(dot(attribute("normal", "vec3f"), sunPos).mul(0.5).add(0.5)), 1);
    }

    public update(dt: number): void {
        super.update(dt);

        if(this.mesh != null) {
            this.mesh.position.copy(this.renderPosition);
            this.mesh.rotation.y = -dlerp(-this.mesh.rotation.y, this.yaw, dt, 24);
        }

        if(this.skin != null) {
            this.skin.skeleton.bones[1].setRotationFromEuler(new Euler(-this.pitch, 0, 0));
        }
    }
}