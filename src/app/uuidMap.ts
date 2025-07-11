export interface UUIDMap<T> {
    get(key: string): T;
}
export interface UUIDMapModifyable<T> extends UUIDMap<T> {
    get(key: string): T;
    set(key: string, value: T): void;
}