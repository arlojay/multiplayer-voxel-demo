export abstract class LibraryDataLocator {
    public abstract get(location: string): Promise<Blob>;
}