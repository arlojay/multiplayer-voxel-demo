import { ArrowHelper, ColorRepresentation, Scene, Vector3 } from "three";

export function debugArrow(direction: Vector3, origin: Vector3, length = 1, color: ColorRepresentation = "#ffffff") {
    if("client" in self) {
        const scene = (self["client"] as any).gameRenderer.scene as Scene;

        const arrow = new ArrowHelper(direction, origin, length, color);
        scene.add(arrow);

        setTimeout(() => {
            arrow.removeFromParent();
        }, 100);
    }
}