import { abs, attribute, cameraPosition, color, dot, float, Fn, If, int, max, mix, modelViewProjection, normalize, positionGeometry, positionLocal, positionWorld, reflect, select, smoothstep, uniform, varying, vec2, vec3, vec4, vertexIndex } from "three/src/nodes/TSL";
import { FaceDirection } from "../voxelMesher";

export const sunPos = normalize(vec3(0.3, 1.0, 0.6));

export const terrainPosition = Fn(() => {
    const vUv = varying(vec2(0, 0), "vUv");
    const vi = vertexIndex.modInt(4);
    If(vi.equal(0), () => {
        vUv.assign(vec2(-0.5, -0.5));
    });
    If(vi.equal(1), () => {
        vUv.assign(vec2(0.5, -0.5));
    });
    If(vi.equal(2), () => {
        vUv.assign(vec2(0.5, 0.5));
    });
    If(vi.equal(3), () => {
        vUv.assign(vec2(-0.5, 0.5));
    });
    
    return modelViewProjection;
})

export const terrainColor = Fn(() => {
    const time = uniform(0);
    time.onFrameUpdate(n => n.time);

    const incident = normalize(cameraPosition.sub(positionWorld)).toVar();
    
    const localPos = attribute("localPos", "vec3f");

    const manhattanDistance = Fn(({ a = vec3(), b = vec3() }) => {
        return abs(a.x.sub(b.x)).add(abs(a.y.sub(b.y))).add(abs(a.z.sub(b.z)));
    });

    const extreme = Fn(({ v = vec3() }) => {
        const a: ReturnType<typeof vec3> = abs(v).toVar();

        return vec3(
            select(a.x.greaterThanEqual(a.y).and(a.x.greaterThanEqual(a.z)), v.x, float(0.0)),
            select(a.y.greaterThanEqual(a.x).and(a.y.greaterThanEqual(a.z)), v.y, float(0.0)),
            select(a.z.greaterThanEqual(a.x).and(a.z.greaterThanEqual(a.y)), v.z, float(0.0))
        )
    });

    const lum = Fn(({ c = color() }) => {
        return c.r.mul(0.2126).add(c.g.mul(0.7152)).add(c.b.mul(0.0722));
    })

    const uv = varying(vec2(0, 0), "vUv");

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
    const faceColor = vec3(float(vColorR).div(0b11111), float(vColorG).div(0b11111), float(vColorB).div(0b11111)).toVar();

    const shadow = dot(normal, sunPos).mul(0.5).add(0.5).mul(float(1).div(ao.pow(2).add(1)));
    const isLightColor = lum({ c: faceColor }).greaterThan(float(0.25));
    const reflection = reflect(incident, normal);

    const outColor = mix(
        faceColor,
        vec3(select(isLightColor, float(0.0), float(1))),
        
        select(
            edgeFactor.greaterThan(0.45),
            float(0.5),
            float(0)
        )
    ).mul(shadow);

    // outColor.assign(vec4(reflection, 0));

    return outColor;
    // return vec4(uv, 0, 1);
})