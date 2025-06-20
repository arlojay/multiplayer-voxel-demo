import { LibraryDataLocator } from "./libraryDataLocator";

export class LibraryDataFetchLocator extends LibraryDataLocator {
    public async get(location: string) {
        return await fetch("assets/" + location).then(response => response.blob());
    }
}