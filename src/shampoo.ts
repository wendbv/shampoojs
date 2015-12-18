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

interface PromiseObj<R> {
    resolve: (data: Response) => void,
    reject: (data: Response) => void,
    promise: Promise<R>
}
interface MessageMap {
    [index: number]: PromiseObj<any>;
}


export class Shampoo {
    index: number = 0;

    socket: WebSocket;
    ready: boolean = false;

    messageMap: MessageMap = {};

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
        let p = this.messageMap[e.data.request_index_number];
        if(e.data.status >= 200 && e.data.status <= 299) {
            p.resolve(e.data.response_data);
        } else {
            p.reject(e.data.response_data);
        }
    }

    private onError(e: Event) {
    }

    private onClose(e: Event) {
        this.ready = false;
    }

    close() {
        this.socket.close();
    }

    call<T>(method: string, data: T): Promise<T> {
        this.index += 1;

        let message: Request<T> = {
            method: method,
            request_data: data,
            index_number: this.index,
        };

        let promiseObj: PromiseObj<T> = {
            resolve: (data: Response) => {},
            reject: (data: Response) => {},
            promise: undefined,
        };

        let promise = promiseObj.promise = new Promise<T>((resolve, reject) => {
            this.sendMessage(message);

            promiseObj.resolve = (data: Response) => {
                resolve(<T>data.response_data);
            };
            promiseObj.reject = (data: Response) => {
                reject(<T>data.response_data);
            };
        });

        this.messageMap[this.index] = promiseObj;

        return promise;
    }

    private sendMessage<T>(data: Request<T>): void {
        this.socket.send(JSON.stringify(data));
    }
}
