import { NegotiationChannel } from "../network/negotiationChannel";
import { DataLibrary } from "./dataLibrary";
import { LibraryDataLocator } from "./libraryDataLocator";

interface AssetResponse {
    type: string;
}

export class LibraryDataNegotiationLocator extends LibraryDataLocator {
    private negotiationChannel: NegotiationChannel;
    
    constructor(negotiationChannel: NegotiationChannel) {
        super();
        this.negotiationChannel = negotiationChannel;
    }
    public async get(location: string) {
        const response = await this.negotiationChannel.request<AssetResponse>("asset", location);
        
        const stream = response.getStream();
        const arrayBuffer = await stream.waitForEnd();

        return new Blob([ arrayBuffer ], { type: response.data.type });
    }
}

export function createLibraryDataNegotiationLocatorServer(negotiationChannel: NegotiationChannel, dataLibrary: DataLibrary) {
    negotiationChannel.onRequest<string, AssetResponse>("asset", async (request, response) => {
        const asset = await dataLibrary.getAsset(request.data);
        const blob = asset.item.blob;

        response.send({ type: blob.type }, await blob.arrayBuffer());
    });
}