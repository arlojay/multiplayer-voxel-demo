import { abs, attribute, color, dot, float, Fn, If, mix, normalize, select, uniform, vec2, vec3, vertexColor } from "three/src/nodes/TSL";

export const sunPos = normalize(vec3(0.3, 1.0, 0.6));

export const terrainColor = Fn(() => {
    const time = uniform(0);
    time.onFrameUpdate(n => n.time);
    
    const localPos = attribute("localPos", "vec3f");
    const vColor = vertexColor();

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
    const preUv = localPosAdjusted.sub(adjustedExtreme).toVar();
    const uv = vec2(0.0).toVar();

    If(normal.x.notEqual(float(0.0)), () => {
        uv.assign(preUv.zy);
    })
    If(normal.y.notEqual(float(0.0)), () => {
        uv.assign(preUv.xz);
    })
    If(normal.z.notEqual(float(0.0)), () => {
        uv.assign(preUv.xy);
        uv.x.mulAssign(float(-1.0));
    })

    const edgeFactor = select(
        abs(uv.x).greaterThan(0.45).or(abs(uv.y).greaterThan(0.45)),
        float(1.0),
        float(0.0)
    );

    const shadow = dot(normal, sunPos).mul(0.5).add(0.5);
    const isLightColor = lum({ c: vColor }).greaterThan(float(0.25));
    const outColor = mix(vColor, vec3(select(isLightColor, float(0.0), float(0.5))), edgeFactor.mul(float(0.5))).mul(shadow);

    return outColor;
})