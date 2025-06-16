export interface Registry<
    ObjectType,
    KeyType
> {
    freeze(): void;
    keys(): Iterator<KeyType>;
    values(): Iterator<ObjectType>;
    entries(): Iterator<[KeyType, ObjectType]>;
}

export interface FactoryRegistry<
    ObjectType,
    KeyType,
    FactoryParams extends ConstructorParameters<any>,
    FactoryType
> extends Registry<FactoryType, KeyType> {
    getFactory(key: KeyType): FactoryType;
    getInstance(key: KeyType, ...params: FactoryParams): ObjectType;
}

export class IndexedFactoryRegistry<
    ObjectType,
    FactoryParams extends ConstructorParameters<any>,
    FactoryType = new (...params: FactoryParams) => ObjectType
> implements FactoryRegistry<ObjectType, number, FactoryParams, FactoryType> {
    protected types: Map<number, FactoryType> = new Map;
    protected nextId: number = 0;
    private frozen: boolean;

    public register(factory: FactoryType): number {
        if(this.frozen) throw new ReferenceError("Registry is frozen");

        this.types.set(this.nextId, factory);
        return this.nextId++;
    }
    public getFactory(key: number): FactoryType {
        return this.types.get(key);
    }
    public getInstance(key: number, ...params: FactoryParams): ObjectType {
        return Reflect.construct<FactoryParams, ObjectType>(this.types.get(key) as any, params);
    }
    public freeze(): void {
        this.frozen = true;
    }
    public keys() {
        return this.types.keys();
    }
    public values() {
        return this.types.values();
    }
    public entries() {
        return this.types.entries();
    }
}

export class HashedRegistryKey<T> {
    public readonly key: T;
    
    public constructor(key: T) {
        this.key = key;
    }
}

export class HashedFactoryRegistry<
    ObjectType,
    KeyType = string,
    FactoryParams extends ConstructorParameters<any> = [],
    FactoryType = new (...params: FactoryParams) => ObjectType,
> implements FactoryRegistry<ObjectType, KeyType | HashedRegistryKey<KeyType>, FactoryParams, FactoryType> {
    protected types: Map<KeyType, FactoryType> = new Map;
    private frozen: boolean;

    public register(id: KeyType, factory: FactoryType): HashedRegistryKey<KeyType> {
        if(this.frozen) throw new ReferenceError("Registry is frozen");

        this.types.set(id, factory);
        return new HashedRegistryKey<KeyType>(id);
    }
    public getFactory(key: KeyType | HashedRegistryKey<KeyType>): FactoryType {
        if(key instanceof HashedRegistryKey)
            return this.types.get(key.key);
            
        return this.types.get(key);
    }
    public getInstance(key: KeyType, ...params: FactoryParams): ObjectType {
        return Reflect.construct<FactoryParams, ObjectType>(this.types.get(key) as any, params);
    }
    public freeze(): void {
        this.frozen = true;
    }
    public keys() {
        return this.types.keys();
    }
    public values() {
        return this.types.values();
    }
    public entries() {
        return this.types.entries();
    }
}

export interface InstanceRegistry<
    ObjectType,
    KeyType,
    FactoryType
> extends Registry<ObjectType, KeyType> {
    makeInstances(): void;
    get(key: KeyType): ObjectType;
    factoryValues(): Iterator<FactoryType>;
    factoryEntries(): Iterator<[KeyType, FactoryType]>;
}



export class IndexedInstancedRegistry<
    ObjectType,
    FactoryType = new () => ObjectType
> implements InstanceRegistry<ObjectType, number, FactoryType> {
    protected factories: Map<number, FactoryType> = new Map;
    protected instances: Map<number, ObjectType> = new Map;
    protected nextId: number = 0;
    private frozen: boolean;

    public register(factory: FactoryType): number {
        if(this.frozen) throw new ReferenceError("Registry is frozen");

        this.factories.set(this.nextId, factory);
        return this.nextId++;
    }
    public makeInstances(): void {
        this.frozen = true;
        for(const [ key, Factory ] of this.factories) {
            this.instances.set(key, Reflect.construct(Factory as any, []));
        }
    }
    public freeze() {
        this.makeInstances();
    }
    public get(key: number): ObjectType {
        if(!this.frozen) throw new ReferenceError("Registry instances not created");
        return this.instances.get(key);
    }
    public keys() {
        return this.factories.keys();
    }
    public values() {
        return this.instances.values();
    }
    public entries() {
        return this.instances.entries();
    }
    public factoryValues() {
        return this.factories.values();
    }
    public factoryEntries() {
        return this.factories.entries();
    }
}

export class HashedInstanceRegistry<
    ObjectType,
    KeyType = string,
    FactoryType = new () => ObjectType,
> implements InstanceRegistry<ObjectType, KeyType | HashedRegistryKey<KeyType>, FactoryType> {
    protected factories: Map<KeyType, FactoryType> = new Map;
    protected instances: Map<KeyType, ObjectType> = new Map;
    private frozen: boolean;

    public register(id: KeyType, factory: FactoryType): HashedRegistryKey<KeyType> {
        if(this.frozen) throw new ReferenceError("Registry is frozen");

        this.factories.set(id, factory);
        return new HashedRegistryKey<KeyType>(id);
    }
    public makeInstances(): void {
        this.frozen = true;
        for(const [ key, Factory ] of this.factories) {
            this.instances.set(key, Reflect.construct(Factory as any, []));
        }
    }
    public get(key: KeyType): ObjectType {
        if(!this.frozen) throw new ReferenceError("Registry instances not created");
        return this.instances.get(key);
    }
    public freeze(): void {
        this.makeInstances();
    }
    public keys() {
        return this.factories.keys();
    }
    public values() {
        return this.instances.values();
    }
    public entries() {
        return this.instances.entries();
    }
    public factoryValues() {
        return this.factories.values();
    }
    public factoryEntries() {
        return this.factories.entries();
    }
}