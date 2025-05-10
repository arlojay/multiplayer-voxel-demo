import { abs, attribute, cameraPosition, color, cos, dot, float, Fn, If, int, max, min, mix, modelViewProjection, normalize, positionGeometry, positionLocal, positionWorld, reflect, select, sin, smoothstep, tan, time, uniform, varying, vec2, vec3, vec4, vertexIndex, vertexStage } from "three/src/nodes/TSL";
import { FaceDirection } from "../voxelMesher";
import { nightFactor, skyColorNode, sunPos } from "./sky";

export const terrainColor = Fn(() => {
    const uv = vertexStage(Fn(() => {
        const uv = vec2(0, 0).toVar();
        const vi = vertexIndex.modInt(4);
        If(vi.equal(0), () => {
            uv.assign(vec2(-0.5, -0.5));
        });
        If(vi.equal(1), () => {
            uv.assign(vec2(0.5, -0.5));
        });
        If(vi.equal(2), () => {
            uv.assign(vec2(0.5, 0.5));
        });
        If(vi.equal(3), () => {
            uv.assign(vec2(-0.5, 0.5));
        });
        return uv;
    })());

    const time = uniform(0);
    time.onFrameUpdate(n => n.time);

    // const incident = normalize(positionWorld.sub(cameraPosition)).toVar();
    
    // const localPos = attribute("localPos", "vec3f");

    // const manhattanDistance = Fn(({ a = vec3(), b = vec3() }) => {
    //     return abs(a.x.sub(b.x)).add(abs(a.y.sub(b.y))).add(abs(a.z.sub(b.z)));
    // });

    // const extreme = Fn(({ v = vec3() }) => {
    //     const a: ReturnType<typeof vec3> = abs(v).toVar();

    //     return vec3(
    //         select(a.x.greaterThanEqual(a.y).and(a.x.greaterThanEqual(a.z)), v.x, float(0.0)),
    //         select(a.y.greaterThanEqual(a.x).and(a.y.greaterThanEqual(a.z)), v.y, float(0.0)),
    //         select(a.z.greaterThanEqual(a.x).and(a.z.greaterThanEqual(a.y)), v.z, float(0.0))
    //     )
    // });

    const lum = Fn(({ c = color() }) => {
        return c.r.mul(0.2126).add(c.g.mul(0.7152)).add(c.b.mul(0.0722));
    })

    const edgeFactor = max(abs(uv.x), abs(uv.y));
    
    const packedAo = int(attribute("ao", "f32").add(0.5)).toVar();
    const topRightAo = float(packedAo.bitAnd(0b11)).toVar();
    const topLeftAo = float(packedAo.bitAnd(0b11 << 2).shiftRight(2)).toVar();
    const bottomLeftAo = float(packedAo.bitAnd(0b11 << 4).shiftRight(4)).toVar();
    const bottomRightAo = float(packedAo.bitAnd(0b11 << 6).shiftRight(6)).toVar();
    const adjustedUvX = smoothstep(0, 1, uv.x.add(0.5).toVar());
    const adjustedUvY = smoothstep(0, 1, uv.y.add(0.5).toVar());
    const ao = mix(mix(bottomLeftAo, bottomRightAo, adjustedUvX), mix(topLeftAo, topRightAo, adjustedUvX), adjustedUvY);

    const faceDirection = packedAo.bitAnd(0b111 << 8).shiftRight(8).toVar();
    const normal = vec3(0, 1, 0).toVar();

    If(faceDirection.equal(FaceDirection.EAST), () => {
        normal.assign(vec3(1, 0, 0));
    });
    If(faceDirection.equal(FaceDirection.WEST), () => {
        normal.assign(vec3(-1, 0, 0));
    });
    If(faceDirection.equal(FaceDirection.NORTH), () => {
        normal.assign(vec3(0, 0, -1));
    });
    If(faceDirection.equal(FaceDirection.SOUTH), () => {
        normal.assign(vec3(0, 0, 1));
    });
    If(faceDirection.equal(FaceDirection.DOWN), () => {
        normal.assign(vec3(0, -1, 0));
    });
    If(faceDirection.equal(FaceDirection.UP), () => {
        normal.assign(vec3(0, 1, 0));
    });

    const vColor = int(attribute("blockColor", "f32").sub(0.5)).toVar();
    const vColorR = vColor.bitAnd(0b0111110000000000).shiftRight(10);
    const vColorG = vColor.bitAnd(0b0000001111100000).shiftRight(5);
    const vColorB = vColor.bitAnd(0b0000000000011111);
    const flatColor = vec3(float(vColorR).div(0b11111), float(vColorG).div(0b11111), float(vColorB).div(0b11111)).toVar();

    const shadow = dot(normal, sunPos).clamp(0, 1).mul(float(1).div(ao.pow(2).add(1))).remap(0, 1, 0.25, 1);
    const isLightColor = lum({ c: flatColor }).greaterThan(float(0.25));
    // const reflection = reflect(incident, normal);

    // const IOR = float(4/3);
    // const halfway = reflection.add(incident).normalize();
    // const fresnel = IOR.add(IOR.oneMinus().mul(halfway.dot(normal).oneMinus().pow(5)));

    // const skyReflection = skyColorNode({ pos: reflection });

    const faceColor = mix(
        flatColor,
        vec3(select(isLightColor, float(0.0), float(1))),
        
        select(
            edgeFactor.greaterThan(0.45),
            float(0.5),
            float(0)
        )
    );

    const dayColor = faceColor.mul(shadow);
    const nightColor = mix(
        faceColor,
        faceColor.mul(color(0, 0, 0.05)),
        shadow.remap(0, 1, 1, 0.95)
    );

    const outColor = mix(dayColor, nightColor, nightFactor);

    // outColor.assign(mix(outColor, skyReflection, fresnel));
    // outColor.assign(vec4(fresnel, fresnel, fresnel, 1));

    return outColor;
    // return vec4(uv, 0, 1);
})