import * as path from "path-browserify";
import { DoubleSide, IUniform, ShaderMaterial, Uniform } from "three";

const shaders: Set<WeakRef<ShaderMaterial>> = new Set;

export function getPathDir(loc: string): string {
    return loc.slice(0, loc.lastIndexOf("/") + 1);
}

export async function loadShaderSource(sourceURL: string): Promise<string> {
    let source = await (await fetch(sourceURL)).text();

    let find = /#include.+/;

    let base = getPathDir(document.location.pathname);

    let result: RegExpExecArray | null;
    while(result = find.exec(source)) {
        let fileName = result[0].slice(10, -1);
        let fileLocation = base + path.join(getPathDir(sourceURL), fileName);
        let fileData = await loadShaderSource(fileLocation.slice(1));


        source =
            source.slice(0, result.index) +
            "\n" + fileData + "\n" +
            source.slice(result.index + result[0].length, source.length);
    }

    return source;
}

export async function loadShaderProgram(source: string, uniforms: object): Promise<ShaderMaterial> {
    const vertexShader = await loadShaderSource(source + ".vsh");
    const fragmentShader = await loadShaderSource(source + ".fsh");

    const shader = new ShaderMaterial({
        uniforms: Object.assign({
            time: new Uniform(0.0)
        }, uniforms),
        vertexShader, fragmentShader,
        vertexColors: false,
        transparent: true,

        // side: DoubleSide
    });

    const ref = new WeakRef(shader);
    shaders.add(ref);

    return shader;
}

export function updateAllShaders(changes: Map<string, any>, ignoreMissing: boolean | null = false) {
    let shader: ShaderMaterial | null, uniform: IUniform | null;
    for(const pshader of shaders) {
        shader = pshader.deref();
        if(shader == null) shaders.delete(pshader);

        for(const [ id, value ] of changes) {
            uniform = shader.uniforms[id];
            if(uniform == null) {
                if(!ignoreMissing) throw new Error("Cannot find uniform " + id + " on shader " + shader.uuid + " (" + shader + ")");
                continue;
            }

            uniform.value = value;
        }
    }
}