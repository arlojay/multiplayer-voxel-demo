import { BlockStateType } from "src/app/block/blockStateType";
import { Block } from "../../block/block";
import { BlockModel, BlockModelCuboid } from "../../block/blockModel";
import { DataLibrary } from "../../datalibrary/dataLibrary";
import { BASIC_COLLIDER } from "../../entity/collisionChecker";
import { ConstantValueGenerator } from "../../noise/impl/generator/constantValueGenerator";
import { SimplexNoiseGenerator } from "../../noise/impl/generator/simplexNoiseGenerator";
import { NoiseOperation, OperationType } from "../../noise/impl/transformer/noiseOperation";
import { NoiseScaler } from "../../noise/impl/transformer/noiseScaler";
import { OctaveNoise } from "../../noise/impl/transformer/octaveNoise";
import { NoiseNode } from "../../noise/noiseNode";
import { BaseRegistries } from "../../synchronization/baseRegistries";
import { CHUNK_SIZE } from "../../world/voxelGrid";
import { Chunk, World } from "../../world/world";
import { WorldGenerator } from "../../world/worldGenerator";
import { Subscribe } from "../events";
import { PluginEvents, ServerLoadedEvent } from "../pluginEvents";
import { ServerPlugin } from "../serverPlugin";

export class SimplexTerrainGenerator extends WorldGenerator {
    private noise: NoiseNode;
    private stoneNoise: NoiseScaler;

    constructor(world: World) {
        super(world);

        this.noise = new NoiseScaler(
            new NoiseOperation(
                new OctaveNoise(
                    new SimplexNoiseGenerator(0, 0),
                    8, 0.5, 2, 0.3
                ),
                new ConstantValueGenerator(160),
                OperationType.MULTIPLY
            ),
            1000, 1000, 1000, 1000
        );
        this.stoneNoise = new NoiseScaler(
            new OctaveNoise(
                new SimplexNoiseGenerator(0, 0),
                2, 0.5, 3, 0.5
            ),
            250, 250, 250, 250
        );
    }
    public generateChunk(chunk: Chunk) {
        const world = this.world;

        let globalX = chunk.blockX;
        let globalY = chunk.blockY;
        let globalZ = chunk.blockZ;

        const grass = world.blockRegistry.getStateType("grass#default");
        const dirt = world.blockRegistry.getStateType("dirt#default");
        const stone = world.blockRegistry.getStateType("stone#default");
        const stoneSandy = world.blockRegistry.getStateType("stone#sandy");

        for(let x = 0; x < CHUNK_SIZE; x++, globalX++) {
            for(let z = 0; z < CHUNK_SIZE; z++, globalZ++) {
                const height = this.noise.sample2d(globalX, globalZ);
                for(let y = 0; y < CHUNK_SIZE; y++, globalY++) {
                    let block: BlockStateType = null;

                    if(globalY < height - 5) {
                        if(this.stoneNoise.sample3d(globalX, globalY, globalZ) > 0) {
                            block = stone;
                        } else {
                            block = stoneSandy;
                        }
                    }
                    else if(globalY < height - 1) block = dirt;
                    else if(globalY < height) block = grass;

                    if(block != null) chunk.setBlockState(x, y, z, block.saveKey);
                }
                globalY -= CHUNK_SIZE;
            }
            globalZ -= CHUNK_SIZE;
        }

        return chunk;
    }
}

export class GrassBlock extends Block {
    public readonly collider = BASIC_COLLIDER.collider;
    
    public async init(dataLibrary: DataLibrary) {
        const texture = await dataLibrary.getAsset("textures/grass2-texture.jpg").then(asset => asset.loadTexture());

        this.addState(
            "default",
            new BlockModel(
                new BlockModelCuboid()
                .createAllFaces()
                .setAllTextures(texture)
            ),
            BASIC_COLLIDER.collider
        );
    }
}

export class DirtBlock extends Block {
    public readonly collider = BASIC_COLLIDER.collider;
    
    public async init(dataLibrary: DataLibrary) {
        const texture = await dataLibrary.getAsset("textures/dirt-texture.png").then(asset => asset.loadTexture());

        this.addState(
            "default",
            new BlockModel(
                new BlockModelCuboid()
                .createAllFaces()
                .setAllTextures(texture)
            ),
            BASIC_COLLIDER.collider
        );
    }
}

export class StoneBlock extends Block {    
    public async init(dataLibrary: DataLibrary) {
        this.addState(
            "default",
            new BlockModel(
                new BlockModelCuboid()
                .createAllFaces()
                .setAllTextures(await dataLibrary.getAsset("textures/stone1-texture.jpg").then(asset => asset.loadTexture()))
            ),
            BASIC_COLLIDER.collider
        );
        this.addState(
            "sandy",
            new BlockModel(
                new BlockModelCuboid()
                .createAllFaces()
                .setAllTextures(await dataLibrary.getAsset("textures/stone2-texture.png").then(asset => asset.loadTexture()))
            ),
            BASIC_COLLIDER.collider
        );
    }
}

export class TerrainPlugin extends ServerPlugin {
    public readonly name = "terrain";

    @Subscribe(PluginEvents.SERVER_LOADED)
    public async onLoad(event: ServerLoadedEvent) {
        const world = event.server.getDefaultWorld();
        world.setGenerator(new SimplexTerrainGenerator(world));
    }

    public async addContent(registries: BaseRegistries) {
        registries.blocks.register("grass", GrassBlock);
        registries.blocks.register("dirt", DirtBlock);
        registries.blocks.register("stone", StoneBlock);
    }
}