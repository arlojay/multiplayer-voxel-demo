import { Texture } from "three";
import { attribute, cameraPosition, color, Discard, dot, float, Fn, If, ivec2, mix, nodeProxy, positionWorld, smoothstep, texture, textureSize, uint, vec2, vec3, vec4, vertexStage } from "three/src/nodes/TSL";
import { NearestFilter, Node, NodeBuilder, TextureLoader } from "three/src/Three.WebGPU";
import { TextureAtlas } from "../texture/textureAtlas";
import { FaceDirection } from "../world/voxelMesher";
import { nightFactor, skyColorNode, sunPos } from "./sky";

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
const unpackIvec2 = Fn(([ number = uint(0) ]) => {
    return ivec2(
        number.bitAnd(uint(0xffff0000)).shiftRight(16).toFloat(),
        number.bitAnd(uint(0x0000ffff)).toFloat(),
    )
})

const terrainMap = texture(new Texture);
const dataTexture = texture(new Texture);


export async function setTextureAtlas(atlas: TextureAtlas) {
    terrainMap.value?.dispose();
    dataTexture.value?.dispose();

    const count = atlas.textures.size;
    const data = new Uint32Array(count * 4);

    for(let i = 0; i < count; i++) {
        const placedObject = atlas.workingAtlas.getPlacedObjectById(i);

        data[i * 4 + 0] = placedObject.left;
        data[i * 4 + 1] = atlas.height - placedObject.bottom;
        data[i * 4 + 2] = placedObject.right;
        data[i * 4 + 3] = atlas.height - placedObject.top;
    }

    const textureDimension = 2 ** Math.ceil(Math.log2(Math.ceil(Math.sqrt(data.byteLength / 4))));

    const canvas = new OffscreenCanvas(textureDimension, textureDimension);
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, textureDimension, textureDimension);
    imageData.data.set(new Uint8Array(data.buffer));
    for(let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    const blob = await canvas.convertToBlob();
    const url = URL.createObjectURL(blob);
    
    const texture = await new TextureLoader().loadAsync(url);
    texture.magFilter = texture.minFilter = NearestFilter;
    
    dataTexture.value = texture;
    terrainMap.value = atlas.builtTexture;

    dataTexture.value.needsUpdate = true;
    terrainMap.value.needsUpdate = true;
}

const getUvFromIndex = Fn(([ index = uint(0), dim = uint(1) ]) => {
    return vec2(
        index.mod(dim).toFloat().add(1).div(dim.toFloat().add(1)),
        index.div(dim).toFloat().add(1).div(dim.toFloat().add(1)).oneMinus(),
    );
});
function convertToU8(num = float()) {
    return num.mul(255).add(0.5).toUint();
}
const colorToU32LE = Fn(([ color = vec4() ]) => {
    return (
        convertToU8(color.r)
        .bitOr(convertToU8(color.g).shiftLeft(8))
        .bitOr(convertToU8(color.b).shiftLeft(16))
    );
});

export const terrainColor = Fn(([viewDistance = float(16)]) => {
    const packedFaceData = attribute("face").toVar("packedFaceData");
    const faceTextureId = packedFaceData.shiftRight(11).toVar("faceTextureId");

    const textureDimension = textureSize(dataTexture).x.toUint();
    const faceTextureMin = vertexStage(vec2(
        colorToU32LE(dataTexture.sample(getUvFromIndex(faceTextureId.mul(4).add(0), textureDimension))).toFloat(),
        colorToU32LE(dataTexture.sample(getUvFromIndex(faceTextureId.mul(4).add(1), textureDimension))).toFloat()
    )).toVar("faceTextureMin");
    const faceTextureMax = vertexStage(vec2(
        colorToU32LE(dataTexture.sample(getUvFromIndex(faceTextureId.mul(4).add(2), textureDimension))).toFloat(),
        colorToU32LE(dataTexture.sample(getUvFromIndex(faceTextureId.mul(4).add(3), textureDimension))).toFloat()
    )).toVar("faceTextureMax");
    const faceTextureSize = faceTextureMax.sub(faceTextureMin).toVar("faceTextureSize");

    const texSize = vec2(textureSize(terrainMap));
    const facePixelSize = faceTextureSize.reciprocal().toVar();

    const rawFaceUv = unpackVec2(attribute("uv")).div(0xffff).toVar();
    const faceUv = vertexStage(rawFaceUv).toVar();

    const v_fpos = unpackVec2(attribute("fpos")).toVar("v_fpos");
    const fpos = vertexStage(vec2(
        v_fpos.x.remap(0x7fdf, 0x801f, -1, 1),
        v_fpos.y.remap(0x7fdf, 0x801f, -1, 1)
    )).toVar("fpos_fromvertex");

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

    const dist = positionWorld.sub(cameraPosition).length();
    const fogFactor = dist.remapClamp(viewDistance.mul(0.75), viewDistance.mul(0.95), 0, 1);
    If(fogFactor.greaterThanEqual(1), () => {
        Discard();
    })
    
    const topRightAo = float(packedFaceData.bitAnd(0b11)).toVar("topRightAo");
    const topLeftAo = float(packedFaceData.bitAnd(0b11 << 2).shiftRight(2)).toVar("topLeftAo");
    const bottomLeftAo = float(packedFaceData.bitAnd(0b11 << 4).shiftRight(4)).toVar("bottomLeftAo");
    const bottomRightAo = float(packedFaceData.bitAnd(0b11 << 6).shiftRight(6)).toVar("bottomRightAo");
    const adjustedFposX = smoothstep(0, 1, fpos.x.remapClamp(-1, 1, 0, 1));
    const adjustedFposY = smoothstep(0, 1, fpos.y.remapClamp(-1, 1, 0, 1));
    const ao = mix(mix(bottomLeftAo, bottomRightAo, adjustedFposX), mix(topLeftAo, topRightAo, adjustedFposX), adjustedFposY);

    const faceDirection = packedFaceData.bitAnd(0b111 << 8).shiftRight(8).toVar("faceDirection");
    const normal = vec3(0, 1, 0).toVar("f_normal");

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

    const vColor = attribute("color").toVar("vColor");
    const vColorR = vColor.bitAnd(0xff0000).shiftRight(16);
    const vColorG = vColor.bitAnd(0x00ff00).shiftRight(8);
    const vColorB = vColor.bitAnd(0x0000ff);
    const flatColor = vertexStage(
        vec3(
            float(vColorR).div(0xff),
            float(vColorG).div(0xff),
            float(vColorB).div(0xff)
        )
    ).toVar("flatColor");

    const aoDarken = float(1).div(ao.pow(1.5).add(1));
    const shadow = dot(normal, sunPos).clamp(0, 1).remap(0, 1, 0.25, 1).mul(aoDarken).toVar();
    
    // const reflection = reflect(incident, normal);

    // const IOR = float(4/3);
    // const halfway = reflection.add(incident).normalize();
    // const fresnel = IOR.add(IOR.oneMinus().mul(halfway.dot(normal).oneMinus().pow(5)));

    // const skyReflection = skyColorNode({ pos: reflection });

    const anisotropyLocations = [
        [1, -1],
        [1, 1],
        [-1, -1],
        [-1, 1],
        [0, 0],
    ]
    const faceColor = vec4(0, 0, 0, 0).toVar();
    const anisotropyCoefficient = dist.mul(texSize).div(128).sqrt().sub(2.4).max(0).div(texSize).toVar();
    const uvClampMin = facePixelSize.mul(0.5).toVar("uvClampMin");
    const uvClampMax = uvClampMin.oneMinus().toVar("uvClampMax");
    for(const [ dx, dy ] of anisotropyLocations) {
        faceColor.addAssign(terrainMap.sample(vec2(
            mix(faceTextureMin.x, faceTextureMax.x, faceUv.x.add(float(dx).mul(anisotropyCoefficient.x)).fract().clamp(uvClampMin.x, uvClampMax.x)).div(texSize.x),
            mix(faceTextureMin.y, faceTextureMax.y, faceUv.y.add(float(dy).mul(anisotropyCoefficient.y)).fract().clamp(uvClampMin.y, uvClampMax.y)).div(texSize.y)
        )));
    }
    faceColor.divAssign(anisotropyLocations.length);

    const dayColor = vec3(0, 0, 0).toVar("dayColor");
    const nightColor = vec3(0, 0, 0).toVar("nightColor");
    
    If(nightColor.lessThan(1), () => {
        dayColor.assign(faceColor.mul(flatColor).mul(shadow));
    })
    If(nightFactor.greaterThan(0), () => {
        nightColor.assign(mix(
            faceColor,
            faceColor.mul(color(0, 0, 0.05)),
            shadow.remap(0, 1, 1, 0.95)
        ));
    });

    const fogColor = vec3(0, 0, 0).toVar("fogColor");
    If(fogFactor.greaterThan(0), () => {
        fogColor.assign(skyColorNode(positionWorld.sub(cameraPosition)));
    })

    const outColor = mix(mix(dayColor, nightColor, nightFactor), fogColor, fogFactor);

    // outColor.assign(mix(outColor, skyReflection, fresnel));
    // outColor.assign(vec4(fresnel, fresnel, fresnel, 1));

    return outColor;
    // return vec4(uv, 0, 1);
})