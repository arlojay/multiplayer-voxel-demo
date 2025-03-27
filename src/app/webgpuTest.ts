export class WebGPUTest {
    public canvas: HTMLCanvasElement;
    public adapter: GPUAdapter;
    public device: GPUDevice;
    public shaderModule: GPUShaderModule;
    public renderPipeline: GPURenderPipeline;
    public context: GPUCanvasContext;
    public depthBuffer: GPUTexture;

    public constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }
    public async init() {
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: "high-performance"
        });
        this.adapter = adapter;


        const device = await adapter.requestDevice();
        this.device = device;
        

        const context = this.canvas.getContext("webgpu");
        context.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat()
        });
        this.context = context;


        const shaderModule = device.createShaderModule({
            code: await fetch("assets/shaders/terrain.wgsl").then(v => v.text())
        });
        this.shaderModule = shaderModule;


        const renderPipeline = device.createRenderPipeline({
            vertex: {
                module: shaderModule,
                entryPoint: "vertex_main",
                buffers: [
                    {
                        attributes: [
                            {
                                shaderLocation: 0, // position
                                offset: 0,
                                format: "float32x4",
                            },
                            {
                                shaderLocation: 1, // color
                                offset: 16,
                                format: "float32x4",
                            },
                        ],
                        arrayStride: 32,
                        stepMode: "vertex",
                    },
                ]
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragment_main",
                targets: [
                    {
                        format: context.getConfiguration().format
                    }
                ]
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus"
            },
            primitive: {
                topology: "triangle-list"
            },
            layout: "auto"
        });
        this.renderPipeline = renderPipeline;
    }

    public render(time: number) {
        const commandEncoder = this.device.createCommandEncoder();

        const vertexData = new Float32Array([
            0, 0, 0, 1,     1, 0, 0, 1,
            1, 0, 0, 1,     0, 1, 0, 1,
            0, 1, 0, 1,     0, 0, 1, 1
        ]);

        const vertexBuffer = this.device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(vertexBuffer, 0, vertexData, 0, vertexData.length);


        const uniformData = new Float32Array([

        ]);

        const uniformBuffer = this.device.createBuffer({
            size: uniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(uniformBuffer, 0, uniformData, 0, uniformData.length);

        

        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.context.getCurrentTexture().createView()
                }
            ],
            depthStencilAttachment: {
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                view: this.depthBuffer.createView(),
            }
        });

        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.draw(3);
        passEncoder.end();


        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
    }

    public resize() {
        this.depthBuffer = this.device.createTexture({
            size: [
                this.canvas.width,
                this.canvas.height,
            ],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        })
    }
}