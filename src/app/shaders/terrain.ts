import { abs, attribute, color, dot, float, Fn, If, int, max, mix, modelViewProjection, normalize, positionLocal, select, uniform, varying, vec2, vec3, vertexIndex } from "three/src/nodes/TSL";

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

    const localPosAdjusted = localPos.sub(vec3(0.5)).toVar();
    const adjustedExtreme = extreme({ v: localPosAdjusted }).toVar();
    const normal = normalize(adjustedExtreme).toVar();
    // const preUv = localPosAdjusted.sub(adjustedExtreme).toVar();
    // const uv = vec2(0.0).toVar();

    // If(normal.x.notEqual(float(0.0)), () => {
    //     uv.assign(preUv.zy);
    // })
    // If(normal.y.notEqual(float(0.0)), () => {
    //     uv.assign(preUv.xz);
    // })
    // If(normal.z.notEqual(float(0.0)), () => {
    //     uv.assign(preUv.xy);
    //     uv.x.mulAssign(float(-1.0));
    // })

    const uv = varying(vec2(0, 0), "vUv");

    const edgeFactor = max(abs(uv.x), abs(uv.y));
    
    const ao = attribute("ao", "f32");

    const vColor = int(attribute("blockColor", "f32").sub(0.5)).toVar();
    const vColorR = vColor.bitAnd(0b0111110000000000).shiftRight(10);
    const vColorG = vColor.bitAnd(0b0000001111100000).shiftRight(5);
    const vColorB = vColor.bitAnd(0b0000000000011111);
    const faceColor = vec3(float(vColorR).div(0b11111), float(vColorG).div(0b11111), float(vColorB).div(0b11111)).toVar();
    const finalColor = faceColor.mul(float(1).div(ao.pow(2).add(1))).toVar();

    const shadow = dot(normal, sunPos).mul(0.5).add(0.5);
    const isLightColor = lum({ c: faceColor }).greaterThan(float(0.25));
    const outColor = mix(
        finalColor,
        vec3(select(isLightColor, float(0.0), float(0.5))),
        
        select(
            edgeFactor.greaterThan(0.45),
            float(0.5),
            float(0)
        )
    ).mul(shadow);

    return outColor;
    // return vec4(uv, 0, 1);
})