import FastPriorityQueue from "fastpriorityqueue";

const EVENT_HANDLER_MAP = Symbol("SubscribeKeys");

type EventKey = string | number;

export abstract class EmittedEvent {
    abstract readonly name: EventKey;
    abstract readonly cancellable: boolean;
    private readonly state = {
        cancelled: false
    };

    public cancel() {
        if(!this.cancellable) throw new ReferenceError("Event " + this.name + " cannot be cancelled");
        this.state.cancelled = true;
    }
    public isCancelled() {
        return this.state.cancelled;
    }
}

export abstract class EventSubscriber {

}

interface SubscriberMethodSignature {
    methodName: string;
    priority: number;
}

type EventHandlerSignature = WeakRef<(event: EmittedEvent) => void>;
interface SubscriberMethodInstance {
    handler: EventHandlerSignature;
    subscriber: WeakRef<EventSubscriber>;
    priority: number;
}


type EventHandlerMap = Map<EventKey, SubscriberMethodSignature>;


const eventComparator = (a: SubscriberMethodInstance, b: SubscriberMethodInstance) => a.priority > b.priority;

export function Subscribe(name: EventKey, priority = 0) {
    return function (target: EventSubscriber, propertyKey: string, descriptor: PropertyDescriptor) {
        const method = Reflect.get(target.constructor.prototype, propertyKey);
        if(!(method instanceof Function)) throw new TypeError("@Subscribe must be used on a method");

        const clazz = target.constructor as any;

        clazz[EVENT_HANDLER_MAP] ??= new Map as EventHandlerMap;
        clazz[EVENT_HANDLER_MAP].set(name, {
            methodName: propertyKey, priority
        });
    };
}
export class EventPublisher {
    private subscribers: WeakSet<EventSubscriber> = new Set;
    private events: Map<EventKey, FastPriorityQueue<SubscriberMethodInstance>> = new Map;

    public addSubscriber(subscriber: EventSubscriber) {
        const handlerMap = (subscriber.constructor as any)[EVENT_HANDLER_MAP] as EventHandlerMap ?? new Map;
        const eventMap: Map<string, EventHandlerSignature> = new Map;

        for(const [eventName, descriptor] of handlerMap.entries()) {
            let eventHandlerList = this.events.get(eventName);
            if(eventHandlerList == null) {
                eventHandlerList = new FastPriorityQueue(eventComparator);
                this.events.set(eventName, eventHandlerList);
            }

            const handler: EventHandlerSignature = new WeakRef(
                Reflect.get(subscriber, descriptor.methodName, subscriber)
            );
            eventHandlerList.add({
                handler,
                priority: descriptor.priority,
                subscriber: new WeakRef(subscriber)
            });
            eventMap.set(descriptor.methodName, handler);
        }
        this.subscribers.add(subscriber);
    }
    public removeSubscriber(subscriber: EventSubscriber) {
        const handlerMap = (subscriber.constructor as any)[EVENT_HANDLER_MAP] as EventHandlerMap;
        this.subscribers.delete(subscriber);

        for(const eventName of handlerMap.keys()) {
            let eventHandlerList = this.events.get(eventName);
            if(eventHandlerList == null) continue;

            eventHandlerList.removeOne(a => a.subscriber?.deref() == subscriber);
        }
    }
    public emit(event: EmittedEvent) {
        Object.freeze(Object.seal(event));

        const eventList = this.events.get(event.name);
        if(eventList == null) return;

        eventList.removeMany((a) => {
            const handler = a.handler.deref();
            const subscriber = a.subscriber.deref();
            if(handler == null || subscriber == null) return true;

            if(event.isCancelled()) return false;

            handler.call(subscriber, event);
            return false;
        })
    }
}