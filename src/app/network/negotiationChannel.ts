import { TypedEmitter } from "tiny-typed-emitter";
import { capabilities } from "../capability";
import { TimedOutError } from "../server/serverPeer";

enum MessageType {
    REQUEST,
    RESPONSE,
    RESPONSE_ERROR,
    DATA_STREAM,
    READY
}

type MessageStructure = [string, MessageType, ...any[]];

interface DataConnectionLike {
    open: boolean;
    close(options?: { flush?: boolean }): void;
    send(data: any, chunked?: boolean): void;

    addListener(event: string, callback: (...params: any[]) => any): void;
    removeListener(event: string, callback?: (...params: any[]) => any): void;
    once(event: string, callback: (...params: any[]) => any): void;
}

interface StreamMessageDescriptor {
    size: number;
    chunkSize: number;
}

interface RequestMessage {
    data: any;
    stream?: StreamMessageDescriptor;
}

export class NegotiationRequest<RequestSchema = any> {
    public channel: NegotiationChannel;
    public id: string;
    public data: RequestSchema;
    private stream: NegotiationStream;

    public constructor(channel: NegotiationChannel) {
        this.channel = channel;
    }

    public hasStream() {
        return this.stream != null;
    }
    public createStream() {
        return this.stream = new NegotiationStream(this.id, NegotiationStreamType.RECEIVE);
    }
    public getStream() {
        return this.stream;
    }
}

interface ResponseMessage {
    data: any;
    stream?: StreamMessageDescriptor;
}

enum NegotiationStreamType {
    SEND,
    RECEIVE
}

interface NegotiationStreamEvents {
    "data": (stream: NegotiationStream, data: ArrayBuffer, index: number) => void;
    "end": (stream: NegotiationStream) => void;
}
class NegotiationStream extends TypedEmitter<NegotiationStreamEvents> {
    public id: string;
    public readonly type: NegotiationStreamType;

    private builtStreamData: Uint8Array<ArrayBuffer>;
    private waitingStreamChunks: number;
    private totalReceivedBytes: number;
    private onStreamFinish: PromiseWithResolvers<ArrayBuffer>;
    private descriptor: StreamMessageDescriptor;

    constructor(id: string, type: NegotiationStreamType) {
        super();
        this.id = id;
        this.type = type;
    }


    public send(connection: DataConnectionLike, streamObject: ArrayBuffer, chunkSize: number) {
        if(this.type != NegotiationStreamType.SEND) throw new TypeError("Not a sending stream");

        for(let i = 0; i < streamObject.byteLength; i += chunkSize) {
            const chunk = streamObject.slice(i, Math.min(i + chunkSize, streamObject.byteLength));

            connection.send([
                this.id,
                MessageType.DATA_STREAM,
                chunk,
                i
            ], false);
        }
    }
    public setStreamData(descriptor: StreamMessageDescriptor) {
        if(this.type != NegotiationStreamType.RECEIVE) throw new TypeError("Not a receiving stream");

        this.descriptor = descriptor;
        this.builtStreamData = new Uint8Array(descriptor.size);
        this.waitingStreamChunks = Math.ceil(descriptor.size / descriptor.chunkSize);
        this.totalReceivedBytes = 0;
        
        this.onStreamFinish = Promise.withResolvers<ArrayBuffer>();
    }

    public waitForEnd() {
        if(this.type != NegotiationStreamType.RECEIVE) throw new TypeError("Not a receiving stream");
        
        return this.onStreamFinish.promise;
    }

    public _addStreamChunk(chunk: ArrayBuffer, index: number) {
        if(this.type != NegotiationStreamType.RECEIVE) throw new TypeError("Not a receiving stream");

        this.builtStreamData.set(new Uint8Array(chunk), index);
        this.waitingStreamChunks--;
        this.totalReceivedBytes += chunk.byteLength;

        this.emit("data", this, chunk, index);

        if(this.waitingStreamChunks == 0) {
            this.onStreamFinish.resolve(this.builtStreamData.buffer as ArrayBuffer);
            return true;
        }
        return false;
    }
    public _close(error: Error) {
        if(this.type != NegotiationStreamType.RECEIVE) throw new TypeError("Not a receiving stream");

        this.onStreamFinish.reject(error);
    }

    get receivedBytes() {
        if(this.type != NegotiationStreamType.RECEIVE) return -1;

        return this.totalReceivedBytes;
    }
    get totalBytes() {
        if(this.type != NegotiationStreamType.RECEIVE) return -1;

        return this.builtStreamData.length;
    }
    get receivedChunks() {
        if(this.type != NegotiationStreamType.RECEIVE) return -1;
        
        return this.totalChunks - this.waitingStreamChunks;
    }
    get totalChunks() {
        if(this.type != NegotiationStreamType.RECEIVE) return -1;
        
        return Math.ceil(this.descriptor.size / this.descriptor.chunkSize);
    }
}

export class NegotiationResponse<ResponseSchema = any> {
    public channel: NegotiationChannel;
    public request: NegotiationRequest;

    private closed = false;

    public constructor(channel: NegotiationChannel) {
        this.channel = channel;
    }

    public send(data: ResponseSchema, streamObject?: ArrayBuffer) {
        if(this.closed) throw new ReferenceError("Response already sent");
        
        const maxSize = capabilities.MAX_WEBRTC_PACKET_SIZE;

        const response: ResponseMessage = { data };
        if(streamObject != null) {
            response.stream = {
                size: streamObject.byteLength,
                chunkSize: maxSize
            }
        }
        this.channel.connection.send([
            this.request.id,
            MessageType.RESPONSE,
            response
        ], true);

        this.closed = true;

        if(streamObject != null) {
            const stream = new NegotiationStream(this.request.id, NegotiationStreamType.SEND);
            stream.send(this.channel.connection, streamObject, maxSize);
        }
    }
    public error(code: number, error: string) {
        if(this.closed) throw new ReferenceError("Response already sent");
        
        this.channel.connection.send([
            this.request.id,
            MessageType.RESPONSE_ERROR,
            code,
            error
        ]);
        
        this.closed = true;
    }
}

class NegotiationRequestResponse<ResponseSchema = any> {
    public connection: DataConnectionLike;
    public id: string;
    public data: ResponseSchema;
    private stream: NegotiationStream;

    constructor(connection: DataConnectionLike) {
        this.connection = connection;
    }

    public hasStream() {
        return this.stream != null;
    }
    public createStream() {
        return this.stream = new NegotiationStream(this.id, NegotiationStreamType.RECEIVE);
    }
    public getStream() {
        return this.stream;
    }
}

interface WaitingResponse {
    id: string;
    resolve(response: NegotiationRequestResponse): void;
    reject(error: Error): void;
}

interface RequestOptions {
    streamObject?: ArrayBuffer;
    timeout?: number;
}

export type NegotiationChannelState = "initialized" | "opening" | "waiting-response" | "open" | "closed";

interface NegotiationChannelEvents {
    "close": () => void;
    "open": () => void;
}

export class RequestError extends Error {
    public code: number;
    constructor(message: string, code: number) {
        super(message + " (" + code + ")");
        this.code = code;
    }
}

export class NegotiationChannel extends TypedEmitter<NegotiationChannelEvents> {
    public connection: DataConnectionLike;
    private requestHandlers: Map<string, (request: NegotiationRequest, response: NegotiationResponse) => void> = new Map;

    private ongoingStreams: Map<string, NegotiationStream> = new Map;
    private waitingResponses: Map<string, WaitingResponse> = new Map;
    public state: NegotiationChannelState = "initialized";

    constructor(connection: DataConnectionLike) {
        super();

        this.connection = connection;
        this.connection.addListener("close", () => {
            this.state = "closed";
            for(const response of this.waitingResponses.values()) {
                response.reject(new Error("Network error"));
            }
            for(const stream of this.ongoingStreams.values()) {
                stream._close(new Error("Network error"));
            }
            this.emit("close");
        })
    }

    public async open(timeout = 10000) {
        if(this.state != "initialized") throw new Error("Cannot open a negotiation channel twice");
        this.state = "opening";

        enum State { ASK_READY, RESPOND_READY }

        const onReady = Promise.withResolvers<void>();

        const dataCallback = (data: MessageStructure) => {
            if(data[1] == MessageType.READY) {
                if(data[2] == State.ASK_READY) {
                    this.connection.send([
                        null,
                        MessageType.READY,
                        State.RESPOND_READY
                    ])
                    this.state = "open";
                    onReady.resolve();
                } else if(data[2] == State.RESPOND_READY) {
                    this.connection.removeListener("data", dataCallback);
                    this.state = "open";
                    onReady.resolve();
                }
            }
        };
        this.connection.addListener("data", dataCallback);

        if(!this.connection.open) {
            await new Promise<void>((res, rej) => {
                const timeoutId = setTimeout(() => {
                    rej(new TimedOutError);
                }, timeout);
                this.connection.once("open", () => {
                    clearTimeout(timeoutId);
                    res();
                });
            });
        }

        this.connection.send([
            null,
            MessageType.READY,
            State.ASK_READY
        ]);
        this.state = "waiting-response";

        await onReady.promise;

        this.connection.addListener("data", (data: MessageStructure) => {
            if(this.state != "open") return console.warn("Negotiation channel is not open");
            
            switch(data[1]) {
                case MessageType.REQUEST:
                    this.handleRequest(data);
                    break;
                case MessageType.DATA_STREAM:
                    this.handleStream(data);
                    break;
                case MessageType.RESPONSE:
                case MessageType.RESPONSE_ERROR:
                    this.handleResponse(data);
                    break;
            }
        });

        this.emit("open");
    }

    public close() {
        this.connection.close({ flush: false });
        this.state = "closed";
    }

    private handleStream([ id, type, buffer, index ]: MessageStructure) {
        const stream = this.ongoingStreams.get(id);
        if(stream == null) {
            console.warn("Received stream for unknown message id " + id);
            return;
        }

        const done = stream._addStreamChunk(buffer, index);

        if(done) {
            this.ongoingStreams.delete(id);
        }
    }
    private handleRequest([ id, type, tag, message ]: MessageStructure) {
        const handler = this.requestHandlers.get(tag);

        if(handler == null) {
            this.connection.send([
                id,
                MessageType.RESPONSE_ERROR,
                404,
                "request tag " + tag + " does not exist"
            ])
            return;
        }

        const request = new NegotiationRequest(this);
        request.id = id;
        request.data = message.data;
        
        if(message.stream != null) {
            const stream = request.createStream();
            stream.setStreamData(message.stream);
            this.ongoingStreams.set(request.id, stream);
        }

        const response = new NegotiationResponse(this);
        response.request = request;

        handler(request, response);
    }
    private handleResponse(message: MessageStructure) {
        const [ id, type ] = message;
        const waitingResponse = this.waitingResponses.get(id);

        if(type == MessageType.RESPONSE) {
            const responseMessage: ResponseMessage = message[2];
            const response = new NegotiationRequestResponse(this.connection);

            response.id = id;
            response.data = responseMessage.data;

            if(responseMessage.stream != null) {
                const stream = response.createStream();
                stream.setStreamData(responseMessage.stream);
                this.ongoingStreams.set(id, stream);
            }

            waitingResponse.resolve(response);
        } else {
            const errorCode: number = message[2];
            const errorText: string = message[3];
            
            waitingResponse.reject(new RequestError(errorText, errorCode));
        }
    }

    public onRequest<RequestSchema = any, ResponseSchema = any>(tag: string, handler: (request: NegotiationRequest<RequestSchema>, response: NegotiationResponse<ResponseSchema>) => void) {
        this.requestHandlers.set(tag, handler);
    }
    public offRequest(tag: string)  {
        this.requestHandlers.delete(tag);
    }
    public request<ResponseSchema = any>(tag: string, data?: any, options: RequestOptions = {}) {
        if(this.state != "open") throw new Error("Negotiation channel is not open");

        options.timeout ??= Infinity;

        const maxSize = capabilities.MAX_WEBRTC_PACKET_SIZE;
        const id = crypto.randomUUID();
        const { resolve, reject, promise } = Promise.withResolvers<NegotiationRequestResponse<ResponseSchema>>();

        const waitingResponse = { id, resolve, reject };
        this.waitingResponses.set(id, waitingResponse);

        const timeoutId = options.timeout == Infinity
            ? -1
            : setTimeout(() => {
                reject(new TimedOutError);
            }, options.timeout);


        const requestMessage: RequestMessage = { data };

        if(options.streamObject != null) {
            requestMessage.stream = {
                chunkSize: maxSize,
                size: options.streamObject.byteLength
            }
        }

        this.connection.send([
            id,
            MessageType.REQUEST,
            tag,
            requestMessage
        ]);

        if(options.streamObject != null) {
            const stream = new NegotiationStream(id, NegotiationStreamType.SEND);
            stream.send(this.connection, options.streamObject, maxSize);
        }

        return promise.finally(() => {
            if(options.timeout != Infinity) clearTimeout(timeoutId);
            this.waitingResponses.delete(id);
        });
    }
}