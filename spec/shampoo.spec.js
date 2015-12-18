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

describe('Shampoo', () => {
    beforeEach(() => {
        this.s = new Shampoo('foo');
    });
    afterEach(() => {
        this.s.close();
        this.s = undefined;
    });

    it('should instantiate right', () => {
        expect(wsSpy).toHaveBeenCalledWith('foo', 'shampoo');
    });

    it('should open correctly', () => {
        this.s.socket.onopen();
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

        this.s.socket.onmessage({data: {
            status: 200,
            message: 'ok',
            response_data: {},
            request_index_number: 1,
        }});
    });

    it('should keep its promises even if something goes wrong', (done) => {
        this.s.call('foo', {})
            .then(() => {}, done);

        this.s.socket.onmessage({data: {
            status: 501,
            message: 'Server Error',
            response_data: {},
            request_index_number: 1,
        }});
    });
});
