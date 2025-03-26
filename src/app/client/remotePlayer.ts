import { Box3, Box3Helper, BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, TextureLoader, Vector3 } from "three";
import { RemoteEntity } from "../entity/remoteEntity";
import { dlerp } from "../math";

const simpleHash = (str: string) => {
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

    public mesh: Object3D;
    public id: string;

    public constructor(id: string) {
        super();
        this.id = id;
        this.mesh = new Group();

        const color = simpleHash(id) & 0xffffff;


        const size = new Vector3;
        this.hitbox.getSize(size);

        const center = new Vector3;
        this.hitbox.getCenter(center);

        const body = new BoxGeometry(size.x, size.y, size.z);
        body.translate(center.x, center.y, center.z);
        const bodyMesh = new Mesh(
            body,
            new MeshBasicMaterial({ color })
        );
        this.mesh.add(bodyMesh);
        

        const face = new PlaneGeometry(size.x, size.x);
        face.rotateY(Math.PI);
        face.translate(0, this.hitbox.max.y - size.x * 0.5, -this.hitbox.max.z - 0.01);
        // face.translate(0, this.hitbox.max.y, 0);
        const faceMesh = new Mesh(
            face,
            new MeshBasicMaterial({ map: new TextureLoader().load("assets/textures/player-face.png") })
        );
        this.mesh.add(faceMesh);
    }

    public update(dt: number): void {
        super.update(dt);

        this.mesh.position.copy(this.renderPosition);
        this.mesh.rotation.y = -dlerp(-this.mesh.rotation.y, this.yaw, dt, 24);
    }
}