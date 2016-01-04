// Kind of a hack to prevent errors in type scoping.
// See: https://github.com/Microsoft/TypeScript/issues/4665
export declare class Promise<T extends any> {
    constructor(...args: any[]);
}


interface Message {
    type: string;
}

interface Response extends Message {
    status: number;
    message: string;
    response_data: any;
    request_index_number: number;
}
interface PushMessage extends Message {
    event_name: string;
    push_data: any;
}
interface ResponseEvent {
    data: Response | PushMessage;
}

interface Request<T> extends Message {
    method: string;
    request_data: T;
    index_number: number;
}

interface MessageMap {
    [index: number]: (data: Response) => void;
}

export type Event = (...args: any[]) => void;
interface eventIndexedEvents {
    [eventIndex: number]: Event;
}
interface EventsMap {
    [name: string]: number[];
}

function isPushMessage(data: Message): data is PushMessage {
    return data.type == 'push';
}
function isResponse(data: Message): data is Response {
    return data.type == 'response';
}


/**
 * Our Shampoo class is really a connection to a WebSocket endpoint. This not
 * only connects, but it also manages all Shampoo-style requests/responses. It
 * keeps track of request indices and, best of all, helps you keep track of
 * requests Promise-style!
 */
export class Shampoo {
    index: number = 0;

    socket: WebSocket;
    ready: boolean = false;
    private messageMap: MessageMap = {};


    private eventIndex: number = 0;

    private map: EventsMap = {};
    private events: eventIndexedEvents = {};

    /**
     * Trigger the event name. If there's nothing to trigger, this'll... well,
     * just do nothing. It's fine, no worries.
     * @param name Event name.
     */
    public trigger(name: string, data?: any) {
        var evts = this.map[name] || [];
        evts.forEach((eventIndex) => this.events[eventIndex](data));
    }

    /**
     * Private event registry. Since all public events are bound to a "special"
     * event name (push:<event>), but there's still some private events you
     * need to be able to bind to we use this private registration method.
     */
    private _on(name: string, func: Event) {
        var evts = this.map[name];
        if(!evts) {
            this.map[name] = evts = [];
        }

        this.eventIndex += 1;
        evts.push(this.eventIndex);

        this.events[this.eventIndex] = func;

        return this.eventIndex;
    }

    /**
     * This binds to push messages by event name.
     * @param name The event name, this can be anything you like.
     * @param func Callback function, will be called when the event is
     *             triggered.
     * @returns    An eventIndex with which you can deregister the event, with
     *             off.
     */
    on(name: string, func: Event) {
        return this._on(`push:${name}`, func);
    }

    onRequestOpen(func: Event) {
        return this._on('requestOpen', func);
    }
    onRequestsClear(func: Event) {
        return this._on('requestsClear', func);
    }

    private _off(name: string, eventIndex: number) {
        var evts = this.map[name];
        if(!evts) return;

        evts.splice(evts.indexOf(eventIndex), 1);
        delete this.events[eventIndex];
    }

    /**
     * Deregister an event.
     * @param name  The event name.
     * @param eventIndex Registration eventIndex, which you get from the on method.
     */
    off(name: string, eventIndex: number) {
        return this._off(`push:${name}`, eventIndex);
    }

    offRequestOpen(eventIndex: number) {
        return this._off('requestOpen', eventIndex);
    }
    offRequestsClear(eventIndex: number) {
        return this._off('requestsClear', eventIndex);
    }


    private _openRequests: number = 0;
    /**
     * The amount of running (open) requests.
     */
    get openRequests() {
        return this._openRequests;
    }

    private openedRequest() {
        this._openRequests += 1;
        this.trigger('requestOpen');
    }
    private closedRequest() {
        this._openRequests -= 1;
        if(this._openRequests == 0) {
            this.trigger('requestsClear');
        }
    }

    /**
     * All we need is URI - and endpoint to connect to. Make sure this is
     * formatted in proper WebSocket format, so `ws://hostna.me/end/point`.
     */
    constructor(uri: string) {
        this.socket = new WebSocket(uri, 'shampoo');

        this.socket.onopen = this.onReady.bind(this);
        this.socket.onmessage = this.onMessage.bind(this);
        this.socket.onerror = this.onError.bind(this);
        this.socket.onclose = this.onClose.bind(this);
    }

    private onReady(e: Event) {
        this.ready = true;
    }

    private onMessage(e: ResponseEvent) {
        let data = e.data;
        if(isPushMessage(data)) {
            this.onPushMessage(data);
        } else if(isResponse(data)) {
            this.messageMap[data.request_index_number](data);
        } else {
            throw new Error('Shampoo: Unknown message type');
        }
    }

    private onError(e: Event) {
    }

    private onClose(e: Event) {
        this.ready = false;
    }

    /**
     * Safely close the Shampoo/WebSocket connection. This will wait for all
     * open requests to clear out and then close the socket. This is pretty
     * much just a nicety and usually you'll want to use `closeNow`.
     * It does set the socket's status to not ready, which means it'll stop
     * accepting any requests.
     */
    close() {
        this.ready = false;
        this._on('requestsClear', () => this.socket.close());
    }

    /**
     * Immediately close the socket. This will not finish up any requests and
     * close the socket. Any open requests will thus be ignored and die off.
     */
    closeNow() {
        this.socket.close();
    }

    private onPushMessage(data: PushMessage) {
        let name = data.event_name
        this.trigger(`push:${name}`, data.push_data);
    }

    /**
     * Call a method with some data. With Typescript, you can make this
     * entirely typesafe, how cool is that?
     * @param method The method name to call.
     * @param data   The data to send along.
     * @returns      A Promise which will be resolved as soon as the response
     *               is received, with the data from the response.
     */
    call<T>(method: string, data: any = {}): Promise<T> {
        if(!this.ready) {
            throw new Error("Shampoo WebSocket not ready");
        }

        this.index += 1;

        let message: Request<T> = {
            type: 'request',
            method: method,
            request_data: data,
            index_number: this.index,
        };

        let response = (data: Response) => {};

        let promise = new Promise<T>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
            this.sendMessage(message);
            this.openedRequest();

            response = (data: Response) => {
                this.closedRequest();
                if(data.status >= 200 && data.status <= 299) {
                    resolve(<T>data.response_data);
                } else {
                    reject({
                        status: data.status,
                        message: data.message,
                        response_data: data.response_data,
                    });
                }
            };
        });

        this.messageMap[this.index] = response;

        return promise;
    }

    private sendMessage<T>(data: Request<T>): void {
        this.socket.send(JSON.stringify(data));
    }
}
