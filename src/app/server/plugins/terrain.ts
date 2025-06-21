import { WorldGenerator } from "../../worldGenerator";
import { ServerPlugin } from "../serverPlugin";
import { NoiseNode } from "../../noise/noiseNode";
import { Chunk, World } from "../../world";
import { NoiseScaler } from "../../noise/impl/transformer/noiseScaler";
import { NoiseOperation, OperationType } from "../../noise/impl/transformer/noiseOperation";
import { OctaveNoise } from "../../noise/impl/transformer/octaveNoise";
import { SimplexNoiseGenerator } from "../../noise/impl/generator/simplexNoiseGenerator";
import { ConstantValueGenerator } from "../../noise/impl/generator/constantValueGenerator";
import { CHUNK_INC_SCL, CHUNK_SIZE, VoxelGridChunk } from "../../voxelGrid";
import { Subscribe } from "../events";
import { PluginEvents, ServerLoadedEvent } from "../pluginEvents";
import { Block } from "../../block/block";
import { BASIC_COLLIDER } from "../../entity/collisionChecker";
import { DataLibrary } from "../../data/dataLibrary";
import { BlockModel, BlockModelCuboid } from "../../block/blockModel";
import { BaseRegistries } from "../../baseRegistries";
import { BlockStateType } from "src/app/block/blockStateType";

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
    public generateChunk(chunk: Chunk) {
        const world = this.world;

        let globalX = chunk.blockX;
        let globalY = chunk.blockY;
        let globalZ = chunk.blockZ;

        const grass = world.blockRegistry.getStateType("grass#default");
        const dirt = world.blockRegistry.getStateType("dirt#default");
        const stone = world.blockRegistry.getStateType("stone#default");

        for(let x = 0; x < CHUNK_SIZE; x++, globalX++) {
            for(let z = 0; z < CHUNK_SIZE; z++, globalZ++) {
                const height = this.noise.sample2d(globalX, globalZ);
                for(let y = 0; y < CHUNK_SIZE; y++, globalY++) {
                    let block: BlockStateType = null;

                    if(globalY < height - 5) block = stone;
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
        const texture = await dataLibrary.getAsset("textures/stone1-texture.jpg").then(asset => asset.loadTexture());

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