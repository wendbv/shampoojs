'use strict';

var rewire = require('rewire');

var sh = rewire('../bin/shampoo');
var Shampoo = sh.Shampoo;

var sendSpy = jasmine.createSpy('WS.Send');
var closeSpy = jasmine.createSpy('WS.Close');
var wsSpy = jasmine.createSpy('WebSocket').and.callFake(
    function() {
        this.onopen = undefined;
        this.onmessage = undefined;
        this.onerror = undefined;
        this.onclose = undefined;
        this.send = sendSpy;
        this.close = closeSpy;

        return this;
    });
sh.__set__('WebSocket', wsSpy);

function buildResponseEvent(index, status, response, message) {
    let data = {
        type: 'response',
        status: status || 200,
        message: message || 'foobar',
        response_data: response || {},
        request_index_number: index,
    };

    return {data: data};
};

describe('Shampoo', () => {
    beforeEach(() => {
        this.s = new Shampoo('foo');

        this.s.socket.onopen();
    });
    afterEach(() => {
        this.s.close();
        this.s = undefined;
    });

    it('should instantiate right', () => {
        expect(wsSpy).toHaveBeenCalledWith('foo', 'shampoo');
    });

    it('should open correctly', () => {
        expect(this.s.ready).toBe(true);
    });

    it('should allow me to call a method', () => {
        spyOn(this.s, 'sendMessage');
        this.s.call('foo', {});

        expect(this.s.sendMessage).toHaveBeenCalled();
    });

    it('should keep its promises', (done) => {
        this.s.call('foo', {})
            .then(done, () => {});

        this.s.socket.onmessage(buildResponseEvent(1));
    });

    it('should keep its promises even if something goes wrong', (done) => {
        this.s.call('foo', {})
            .then(() => {}, done);

        this.s.socket.onmessage(buildResponseEvent(1, 501));
    });

    it('should be able to keep track of multiple requests', (done) => {
        this.s.call('foo', {})
            .then(() => {});
        this.s.call('bar', {})
            .then(done, () => {});

        this.s.socket.onmessage(buildResponseEvent(1));
        this.s.socket.onmessage(buildResponseEvent(2));
    });

    it('should notify when a requests has been opened', (done) => {
        this.s.onRequestOpen = done;

        this.s.call('foo', {});
        this.s.socket.onmessage(buildResponseEvent(2));
    });

    it('should notify when alle events have cleared', (done) => {
        this.s.onRequestsClear = done;

        this.s.call('foo', {});
        this.s.call('bar', {});

        this.s.socket.onmessage(buildResponseEvent(1));
        this.s.socket.onmessage(buildResponseEvent(2));
    });
});
