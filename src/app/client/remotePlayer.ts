import { Box3, Box3Helper, BoxGeometry, Mesh, MeshBasicMaterial, Object3D, Vector3 } from "three";
import { RemoteEntity } from "../entity/remoteEntity";

export class RemotePlayer extends RemoteEntity {
    public hitbox: Box3 = new Box3(
        new Vector3(-0.3, 0, -0.3),
        new Vector3(0.3, 1.8, 0.3)
    );
    public yaw: number = Math.PI * 0.25;
    public pitch: number = 0;

    public mesh: Object3D;

    public constructor() {
        super();

        const vector = new Vector3;
        this.hitbox.getSize(vector);
        const geometry = new BoxGeometry(vector.x, vector.y, vector.z);
        this.hitbox.getCenter(vector);
        geometry.translate(vector.x, vector.y, vector.z);
        this.mesh = new Mesh(
            geometry,
            new MeshBasicMaterial({ color: 0xffff00 })
        );
    }

    public update(dt: number): void {
        super.update(dt);

        this.mesh.position.copy(this.renderPosition);
    }
}