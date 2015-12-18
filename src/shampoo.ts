/// <reference path="typings/promise.d.ts" />

interface Response {
    status: number;
    message: string;
    response_data: any;
    request_index_number: number;
}
interface ResponseEvent extends Event {
    data: Response;
}

interface Request<T> {
    method: string;
    request_data: T;
    index_number: number;
}

interface MessageMap {
    [index: number]: (data: Response) => void;
}


/**
 * Our Shampoo class is really an connection to a WebSocket endpoint. This not
 * only connects, but it also manages all Shampoo-style requests/responses. It
 * keeps track of request indices and, best of all, helps you keep track of
 * requests Promise-style!
 */
export class Shampoo {
    index: number = 0;

    socket: WebSocket;
    ready: boolean = false;
    messageMap: MessageMap = {};

    /**
     * The onRequestsClear event will be called when there are zero requests
     * left running. This is (obviously) not a very powerful event manager, but
     * that's out of scope for now. Just a simple callback.
     */
    onRequestsClear: () => void = () => {};

    /**
     * The onRequestOpen event will be called when a request is opened.
     */
    onRequestOpen: () => void = () => {};

    private _openRequests: number = 0;
    /**
     * openRequests returns the amount of running (open) requests.
     */
    get openRequests() {
        return this._openRequests;
    }

    private openedRequest() {
        this._openRequests += 1;
        this.onRequestOpen();
    }
    private closedRequest() {
        this._openRequests -= 1;
        if(this._openRequests == 0) {
            this.onRequestsClear();
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
        this.messageMap[e.data.request_index_number](e.data);
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
        this.onRequestsClear = (() => this.socket.close());
    }

    /**
     * Immediately close the socket. This will not finish up any requests and
     * close the socket. Any open requests will thus be ignored and die off.
     */
    closeNow() {
        this.socket.close();
    }

    /**
     * Call a method with some data. With Typescript, you can make this
     * entirely typesafe, how cool is that?
     * @param method The method name to call.
     * @param data   The data to send along.
     * @returns      A Promise which will be resolved as soon as the response
     *               is received, with the data from the response.
     */
    call<T>(method: string, data: T): Promise<T> {
        if(!this.ready) {
            throw new Error("Shampoo WebSocket not ready");
        }

        this.index += 1;

        let message: Request<T> = {
            method: method,
            request_data: data,
            index_number: this.index,
        };

        let response = (data: Response) => {};

        let promise = new Promise<T>((resolve, reject) => {
            this.sendMessage(message);
            this.openedRequest();

            response = (data: Response) => {
                this.closedRequest();
                if(data.status >= 200 && data.status <= 299) {
                    resolve(<T>data.response_data);
                } else {
                    reject(<T>data.response_data);
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
