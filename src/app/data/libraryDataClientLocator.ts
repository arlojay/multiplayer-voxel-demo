import { ServerSession } from "../client/serverSession";
import { LibraryDataRequestPacket, LibraryDataResponsePacket } from "../packet";
import { LibraryDataLocator } from "./libraryDataLocator";

export class LibraryDataClientLocator extends LibraryDataLocator {
    public serverSession: ServerSession;

    constructor(serverSession: ServerSession) {
        super();
        
        this.serverSession = serverSession;
    }
    public async get(location: string) {
        this.serverSession.sendPacket(new LibraryDataRequestPacket(location));
        const response = await this.serverSession.waitForPacket<LibraryDataResponsePacket>(
            packet => packet instanceof LibraryDataResponsePacket,
            30000
        );

        return new Blob([response.buffer], { type: response.type });
    }
}