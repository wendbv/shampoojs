# shampoojs

[![Build Status](http://img.shields.io/travis/wendbv/shampoojs.svg)](https://travis-ci.org/wendbv/shampoojs)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](https://tldrlegal.com/license/mit-license)

Implementation of the Shampoo protocol, written in Typescript and compiled to
Javascript. For protocol specifications, see [wendbv/shampoo][protocol]


## Install
Installation is simple. Do an `npm install --save wendbv/shampoojs` - we
haven't yet published to npm because we haven't used Shampoo extensively enough
yet internally to qualify it as a mature protocol. So, this is in beta for now.


## How to
### Instantiate
Instantiating a connection with a Shampoo-compatible WebSocket is very simple,
all you need to do is create an instance of the Shampoo class.  ShampooJS
automatically establishes a connection, you can't defer that, I'm sorry.

```javascript
var s = new Shampoo('http://example.com/path/to/socket');
```


### Calling methods
The `call(method, data)` method allows you to call a Shampoo-style method. It
gives you a Promise which will be fulfilled only when the server sends a
response. It'll automatically handle Shampoo-style errors and throw an
exception. Note that if the connection somehow breaks, any open promises will
not be fulfilled.

```javascript
s.call('foo', {some: 'data':, for: 'example'})
    .then(function(data) {
        // handle response
    }, function(data) {
        // handle error
        // data format is like a stripped-down Shampoo response:
        // {
        //     status: number,
        //     message: string,
        //     response_data: string,
        // }
    });

// are there open requests? we can check!
if(s.openRequests) // this is a number, so truthiness check works
    console.log('open request!');
```


### Push messages
Handling push messages as well is super simple. We use a small but fairly
powerful events system inside ShampooJS, which allows you to use the publicly
exposed `on` method to bind to push messages. Now, since every push message
has an `event_name` we can transparently bind to those event names. `on`
returns an identifier for the event (a number), which can be used to unbind it.

```javascript
var e = s.on('bar', function(data) {
    // handle push message 'bar'
});

// aaaand turn it back off!
s.off('bar', e);
```


### Other events
There's a few other events, which can be bound to with specific methods:

```javascript
var so = s.onSocketOpen(function() {
    console.log('socket opened');
});
s.offSocketOpen(so);

var ro = s.onRequestOpen(function() {
    console.log('request opened');
});
s.offRequestOpen(ro);

var rc = s.onRequestsClear(function() {
    console.log('s.openRequests went from a non-zero integer to zero');
});
s.offRequestsClear(rc);
```


[Protocol]: https://github.com/wendbv/shampoo
