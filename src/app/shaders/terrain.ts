import { abs, attribute, cameraPosition, color, dot, float, floor, Fn, If, int, max, mix, nodeProxy, positionWorld, round, select, smoothstep, texture, textureSize, uint, vec2, vec3, vec4, vertexStage } from "three/src/nodes/TSL";
import { FaceDirection } from "../voxelMesher";
import { nightFactor, skyColorNode, sunPos } from "./sky";
import { Texture } from "three";
import { CodeNode, FunctionNode, Node, NodeBuilder } from "three/src/Three.WebGPU";

// https://github.com/mrdoob/three.js/issues/30663


const bitcast = nodeProxy(class BitcastNode extends Node {
    public input: Node;
    public outputType: string;

    static get type(): string {
        return "BitcastNode";
    }
    constructor(input: Node, outputType: string) {
        super();
        this.input = input;
        this.outputType = outputType;
    }
    public generate(builder: NodeBuilder) {
        const inputType = this.input.getNodeType(builder);
        const code = "bitcast<u32>(" + this.input.build(builder, inputType) + ")";
        return builder.format(code, inputType, this.outputType);
    }
})

const unpackVec2 = Fn(([ number = uint(0) ]) => {
    return vec2(
        number.bitAnd(uint(0xffff0000)).shiftRight(16).toFloat(),
        number.bitAnd(uint(0x0000ffff)).toFloat(),
    )
})

export const terrainMap = texture(new Texture);

export const terrainColor = Fn(([viewDistance = float(16)]) => {
    const packedAo = attribute("ao").toVar();

    const texSize = vec2(textureSize(terrainMap));
    const uv = vertexStage(unpackVec2(attribute("uv")).div(texSize)).toVar();

    const v_fpos = unpackVec2(attribute("fpos")).toVar();
    const fpos = vertexStage(vec2(
        v_fpos.x.remap(0x7fdf, 0x801f, -1, 1),
        v_fpos.y.remap(0x7fdf, 0x801f, -1, 1)
    )).toVar();

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

    // const s = 32;
    // return vec4(vec3(
    //     floor(uv.x.mul(s)).add(floor(uv.y.mul(s))).bitAnd(1).toFloat()
    // ), 1);

    const lum = Fn(({ c = color() }) => {
        return c.r.mul(0.2126).add(c.g.mul(0.7152)).add(c.b.mul(0.0722));
    })

    const edgeFactor = max(abs(uv.x.sub(0.5)), abs(uv.y.sub(0.5)));
    
    const topRightAo = float(packedAo.bitAnd(0b11)).toVar();
    const topLeftAo = float(packedAo.bitAnd(0b11 << 2).shiftRight(2)).toVar();
    const bottomLeftAo = float(packedAo.bitAnd(0b11 << 4).shiftRight(4)).toVar();
    const bottomRightAo = float(packedAo.bitAnd(0b11 << 6).shiftRight(6)).toVar();
    const adjustedFposX = smoothstep(0, 1, fpos.x.remapClamp(-1, 1, 0, 1));
    const adjustedFposY = smoothstep(0, 1, fpos.y.remapClamp(-1, 1, 0, 1));
    const ao = mix(mix(bottomLeftAo, bottomRightAo, adjustedFposX), mix(topLeftAo, topRightAo, adjustedFposX), adjustedFposY);

    const faceDirection = packedAo.bitAnd(0b111 << 8).shiftRight(8).toVar();
    const normal = vec3(0, 1, 0).toVar();
    const dist = positionWorld.sub(cameraPosition).length();
    const fogFactor = dist.remapClamp(viewDistance.mul(0.75), viewDistance.mul(0.95), 0, 1);

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

    const vColor = attribute("color").toVar();
    const vColorR = vColor.bitAnd(0xff0000).shiftRight(16);
    const vColorG = vColor.bitAnd(0x00ff00).shiftRight(8);
    const vColorB = vColor.bitAnd(0x0000ff);
    const flatColor = vertexStage(
        vec3(
            float(vColorR).div(0xff),
            float(vColorG).div(0xff),
            float(vColorB).div(0xff)
        )
    ).toVar();

    const aoDarken = float(1).div(ao.pow(1.5).add(1));
    const shadow = dot(normal, sunPos).clamp(0, 1).remap(0, 1, 0.25, 1).mul(aoDarken);
    const isLightColor = lum({ c: flatColor }).greaterThan(float(0.25));
    // const reflection = reflect(incident, normal);

    // const IOR = float(4/3);
    // const halfway = reflection.add(incident).normalize();
    // const fresnel = IOR.add(IOR.oneMinus().mul(halfway.dot(normal).oneMinus().pow(5)));

    // const skyReflection = skyColorNode({ pos: reflection });

    const faceColor = terrainMap.sample(uv).mul(flatColor).toVar();

    const dayColor = faceColor.mul(shadow);
    const nightColor = mix(
        faceColor,
        faceColor.mul(color(0, 0, 0.05)),
        shadow.remap(0, 1, 1, 0.95)
    );

    const outColor = mix(mix(dayColor, nightColor, nightFactor), skyColorNode(positionWorld.sub(cameraPosition)), fogFactor);

    // outColor.assign(mix(outColor, skyReflection, fresnel));
    // outColor.assign(vec4(fresnel, fresnel, fresnel, 1));

    return outColor;
    // return vec4(uv, 0, 1);
})