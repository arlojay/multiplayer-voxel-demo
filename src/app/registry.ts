export interface Registry<
    ObjectType,
    KeyType
> {
    freeze(): void;
    keys(): Iterator<KeyType>;
    values(): Iterator<ObjectType>;
    entries(): Iterator<[KeyType, ObjectType]>;
}

export abstract class RegistryObject<KeyType> {
    public id: KeyType;
}

export interface FactoryRegistry<
    ObjectType,
    KeyType,
    FactoryParams extends ConstructorParameters<any>,
    FactoryType
> extends Registry<FactoryType, KeyType> {
    getFactory(key: KeyType): FactoryType;
    getInstance(key: KeyType, ...params: FactoryParams): ObjectType;
    getKeyOfFactory(factory: FactoryType): KeyType;
}

export class IndexedFactoryRegistry<
    ObjectType,
    FactoryParams extends ConstructorParameters<any>,
    FactoryType = new (...params: FactoryParams) => ObjectType
> implements FactoryRegistry<ObjectType, number, FactoryParams, FactoryType> {
    protected types: Map<number, FactoryType> = new Map;
    protected typeKeys: Map<FactoryType, number> = new Map;
    protected nextId: number = 0;
    private frozen: boolean;

    public register(factory: FactoryType): number {
        if(this.frozen) throw new ReferenceError("Registry is frozen");

        this.types.set(this.nextId, factory);
        this.typeKeys.set(factory, this.nextId);
        return this.nextId++;
    }
    public getFactory(key: number): FactoryType {
        return this.types.get(key);
    }
    public getInstance(key: number, ...params: FactoryParams): ObjectType {
        const instance = Reflect.construct<FactoryParams, ObjectType>(this.types.get(key) as any, params);
        if(instance instanceof RegistryObject) instance.id = key;
        return instance;
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
    public getKeyOfFactory(factory: FactoryType): number {
        return this.typeKeys.get(factory);
    }
}

export class HashedFactoryRegistry<
    ObjectType,
    KeyType = string,
    FactoryParams extends ConstructorParameters<any> = [],
    FactoryType = new (...params: FactoryParams) => ObjectType,
> implements FactoryRegistry<ObjectType, KeyType, FactoryParams, FactoryType> {
    protected types: Map<KeyType, FactoryType> = new Map;
    protected typeKeys: Map<FactoryType, KeyType> = new Map;
    private frozen: boolean;

    public register(id: KeyType, factory: FactoryType): KeyType {
        if(this.frozen) throw new ReferenceError("Registry is frozen");

        this.types.set(id, factory);
        this.typeKeys.set(factory, id);
        return id;
    }
    public getFactory(key: KeyType): FactoryType {
        return this.types.get(key);
    }
    public getInstance(key: KeyType, ...params: FactoryParams): ObjectType {
        const instance = Reflect.construct<FactoryParams, ObjectType>(this.types.get(key) as any, params);
        if(instance instanceof RegistryObject) instance.id = key;
        return instance;
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
    public getKeyOfFactory(factory: FactoryType): KeyType {
        return this.typeKeys.get(factory);
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
    getKeyOf(instance: ObjectType): KeyType;
    getKeyOfFactory(factory: FactoryType): KeyType;
}



export class IndexedInstancedRegistry<
    ObjectType,
    FactoryParams extends ConstructorParameters<any> = [],
    FactoryType = new (...params: FactoryParams) => ObjectType,
> implements InstanceRegistry<ObjectType, number, FactoryType> {
    protected factories: Map<number, FactoryType> = new Map;
    protected factoryKeys: Map<FactoryType, number> = new Map;
    protected instances: Map<number, ObjectType> = new Map;
    protected instanceKeys: Map<ObjectType, number> = new Map;
    protected nextId: number = 0;
    private frozen: boolean;

    public register(factory: FactoryType): number {
        if(this.frozen) throw new ReferenceError("Registry is frozen");

        this.factories.set(this.nextId, factory);
        this.factoryKeys.set(factory, this.nextId);
        return this.nextId++;
    }
    public makeInstances(...params: FactoryParams): void {
        this.frozen = true;
        for(const [ key, Factory ] of this.factories) {
            const instance = Reflect.construct(Factory as any, params) as ObjectType;
            if(instance instanceof RegistryObject) instance.id = key;
            
            this.instances.set(key, instance);
            this.instanceKeys.set(instance, key);
        }
    }
    public freeze(...params: FactoryParams) {
        this.makeInstances(...params);
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
    public getKeyOf(instance: ObjectType): number {
        return this.instanceKeys.get(instance);
    }
    public getKeyOfFactory(factory: FactoryType): number {
        return this.factoryKeys.get(factory);
    }
}

export class HashedInstanceRegistry<
    ObjectType,
    KeyType = string,
    FactoryParams extends ConstructorParameters<any> = [],
    FactoryType = new (...params: FactoryParams) => ObjectType,
> implements InstanceRegistry<ObjectType, KeyType, FactoryType> {
    protected factories: Map<KeyType, FactoryType> = new Map;
    protected factoryKeys: Map<FactoryType, KeyType> = new Map;
    protected instances: Map<KeyType, ObjectType> = new Map;
    protected instanceKeys: Map<ObjectType, KeyType> = new Map;
    private frozen: boolean;

    public register(id: KeyType, factory: FactoryType): KeyType {
        if(this.frozen) throw new ReferenceError("Registry is frozen");

        this.factories.set(id, factory);
        this.factoryKeys.set(factory, id);
        
        return id;
    }
    public makeInstances(...params: FactoryParams): void {
        this.frozen = true;
        for(const [ key, Factory ] of this.factories) {
            const instance = Reflect.construct(Factory as any, params) as ObjectType;
            if(instance instanceof RegistryObject) instance.id = key;

            this.instances.set(key, instance);
            this.instanceKeys.set(instance, key);
        }
    }
    public get(key: KeyType): ObjectType {
        if(!this.frozen) throw new ReferenceError("Registry instances not created");
        return this.instances.get(key);
    }
    public freeze(...params: FactoryParams): void {
        this.makeInstances(...params);
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
    public getKeyOf(instance: ObjectType): KeyType {
        return this.instanceKeys.get(instance);
    }
    public getKeyOfFactory(factory: FactoryType): KeyType {
        return this.factoryKeys.get(factory);
    }
}