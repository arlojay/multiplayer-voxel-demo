import { color, float, Fn, min, mix, normalize, positionLocal, smoothstep, vec3 } from "three/src/nodes/TSL";

// export const sunPos = normalize(vec3(cos(time), tan(cos(time.mul(0.25)).mul(Math.PI/2)), sin(time)));
export const sunPos = normalize(vec3(0.3, 1, 0.6)).toVar();

export const moonPos = sunPos.mul(vec3(-1, -1, -1));
export const nightFactor = sunPos.y.remapClamp(-0.1, 0.1, 1, 0);


// function octaveNoise(detail = 2, roughness = 0.5, lacunarity = 2) {
//     return Fn(({ texcoord = vec3(0, 0, 0) }) => {
//         let scale = 1;
//         let contrib = 1;
//         let max = 0;

//         let node = float(0);
//         for(let i = 0; i < detail; i++) {
//             max += contrib;
//             node = node.add(mx_noise_float(texcoord.mul(scale)).mul(contrib));
//             contrib *= roughness;
//             scale *= lacunarity;
//         }

//         return node.div(max);
//     });
// };

export const celestialBody = Fn(([ dot = float(0), radius = float(10), haloSize = float(1), haloIntensity = float(0.25) ]) => {
    radius = radius.div(1000).toVar();
    const sunFactor = smoothstep(0, 1, dot.remapClamp(radius.oneMinus(), radius.oneMinus().div(0.99975), 0, 1)).toVar();
    sunFactor.assign(min(1, sunFactor.add(dot.remapClamp(radius.mul(haloSize.add(1)).oneMinus(), radius.oneMinus(), 0, haloIntensity))));

    return sunFactor;
})

export const skyColorNode = Fn(([ pos = vec3(0, 0, 0) ]) => {
    const positionNormalized = normalize(pos).toVar();
    // const height = float(2);
    // const skyPos = vec2(
    //     positionNormalized.x.div(positionNormalized.y.div(height)),
    //     positionNormalized.z.div(positionNormalized.y.div(height)),
    // ).toVar();
    // const volSkyPos = vec3(skyPos.x, height, skyPos.y).toVar();
    // const castDir = vec3(skyPos.x, 1, skyPos.y).toVar();


    // const noise = octaveNoise(3);

    // const volumeFactor = float(0).toVar();
    // const reach = float(0).toVar();
    // const index = int(0).toVar();
    // const iterations = 8;
    // const extent = 1;

    // Loop(index.lessThan(iterations), () => {
    //     const v = noise({ texcoord: volSkyPos.add(castDir.mul(float(2).pow(reach)).add(vec3(1, 0, 1).mul(time))) }).sub(reach.div(extent / 2).sub(1).abs());
    //     volumeFactor.addAssign(float(10).pow(max(0, v)));
    //     reach.addAssign(extent / iterations);
    //     index.addAssign(1);
    // });
    // volumeFactor.divAssign(iterations);

    // const b = volumeFactor.log().remap(-1, 1, -1, 1).toVar();
    // const b = noise({ texcoord: skyPos }).toVar();
    // const b = mx_noise_float(skyPos, 1).toVar();

    const sunPosDot = sunPos.dot(positionNormalized).toVar();
    // const sunFactor = smoothstep(0, 1, sunPosDot.remapClamp(0.996, 0.99625, 0, 1));
    // sunFactor.assign(min(1, sunFactor.add(sunPosDot.remapClamp(0.956, 0.99625, 0, 0.25))));

    // const moonPosDot = moonPos.dot(positionNormalized).toVar();
    // const moonFactor = smoothstep(0, 1, moonPosDot.remapClamp(0.996, 0.99625, 0, 1));
    // moonFactor.assign(min(1, moonFactor.add(moonPosDot.remapClamp(0.986, 0.99625, 0, 0.125))));

    const sunFactor = celestialBody(sunPosDot, 3, 1, 0.25);
    const moonFactor = celestialBody(moonPos.dot(positionNormalized), 1, 3, 0.02);
    

    // return mix(color(0, 0, 0), color(1, 1, 1), sunFactor);

    // return vec4(b, b, b, 1);
    const sky = mix(
        color(0.2, 0.3, 0.4),
        color(0.6, 0.7, 0.8),
        smoothstep(-0.5, 0.5,
            positionNormalized.y.mul(2/3).add(sunPosDot.mul(1/3))
        )
    ).pow(2).mul(1.5);
    const daySky = mix(sky, color(1, 1, 1), sunFactor);
    const nightSky = mix(color(0, 0, 0), color(1, 1, 1), moonFactor)
    return mix(daySky, nightSky, nightFactor);
})

export const skyColor = Fn(() => {
    return skyColorNode(positionLocal);
})