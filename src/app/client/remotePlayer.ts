import { Box3, Vector3 } from "three";
import { RemoteEntity } from "../entity/remoteEntity";
import { PlayerModel } from "./playerModel";

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

    public id: string;
    public model: PlayerModel;
    public username = "anonymous";
    public color = "#ffffff";

    public get mesh() {
        return this.model.mesh;
    }

    public constructor(id: string) {
        super();
        this.id = id;
        this.model = new PlayerModel();
    }
    public dispose() {
        this.model.dispose();
    }
    public update(dt: number): void {
        super.update(dt);

        this.model.pitch = this.pitch;
        this.model.yaw = this.yaw;
        this.model.position.copy(this.renderPosition);
        this.model.username = this.username;
        this.model.color = this.color;
        this.model.update(dt);
    }
}