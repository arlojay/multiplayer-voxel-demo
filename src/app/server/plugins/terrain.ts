import { WorldGenerator } from "../../worldGenerator";
import { ServerPlugin } from "../serverPlugin";
import { NoiseNode } from "../../noise/noiseNode";
import { World } from "../../world";
import { NoiseScaler } from "../../noise/impl/transformer/noiseScaler";
import { NoiseOperation, OperationType } from "../../noise/impl/transformer/noiseOperation";
import { OctaveNoise } from "../../noise/impl/transformer/octaveNoise";
import { SimplexNoiseGenerator } from "../../noise/impl/generator/simplexNoiseGenerator";
import { ConstantValueGenerator } from "../../noise/impl/generator/constantValueGenerator";
import { CHUNK_INC_SCL, CHUNK_SIZE, VoxelGridChunk } from "../../voxelGrid";
import { Subscribe } from "../events";
import { PluginEvents, ServerLoadedEvent } from "../pluginEvents";

export class SimplexTerrainGenerator extends WorldGenerator {
    private noise: NoiseNode;

    constructor(world: World) {
        super(world);

        this.noise = new NoiseScaler(
            new NoiseOperation(
                new OctaveNoise(
                    new SimplexNoiseGenerator(0, 0),
                    8, 0.5, 2, 0.3
                ),
                new ConstantValueGenerator(60),
                OperationType.MULTIPLY
            ),
            100, 100, 100, 100
        );
    }
    public generateChunk(x: number, y: number, z: number): VoxelGridChunk {
        const world = this.world;

        const chunk = world.blocks.getChunk(x, y, z);
        let globalX = x << CHUNK_INC_SCL;
        let globalY = y << CHUNK_INC_SCL;
        let globalZ = z << CHUNK_INC_SCL;

        for(let x = 0; x < CHUNK_SIZE; x++, globalX++) {
            for(let z = 0; z < CHUNK_SIZE; z++, globalZ++) {
                const height = this.noise.sample2d(globalX, globalZ);
                for(let y = 0; y < CHUNK_SIZE; y++, globalY++) {
                    let color = 0x000000;

                    if(globalY < height - 5) color = 0x888888;
                    else if(globalY < height - 1) color = 0xCC9966;
                    else if(globalY < height) color = 0xBBFF99;

                    if(color != 0x000000) chunk.set(x, y, z, world.getValueFromColor(color));
                }
                globalY -= CHUNK_SIZE;
            }
            globalZ -= CHUNK_SIZE;
        }

        return chunk;
    }
}

export class TerrainPlugin extends ServerPlugin {
    @Subscribe(PluginEvents.SERVER_LOADED)
    public async onLoad(event: ServerLoadedEvent) {
        const world = event.server.getDefaultWorld();
        world.setGenerator(new SimplexTerrainGenerator(world));
    }
}