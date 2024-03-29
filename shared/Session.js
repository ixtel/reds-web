"use strict";

var events = require("events");
var HttpError = require("./HttpError");

module.exports = exports = function(server, request, response) {
    events.EventEmitter.call(this);
    this.$requestJson = undefined;
    this.$responseText = undefined;
    this.$selector = undefined;
    this.$type = undefined;
    this.server = server;
    this.request = request;
    this.response = response;
    this.requestText = '';
    // NOTE Will be set in run()
    this.crypto = null;
    this.storage = null;
}

exports.prototype = Object.create(events.EventEmitter.prototype);



exports.prototype.HookHandlers = null;

exports.prototype.run = function() {
    if (this.$benchmark) {
        console.log("BENCHMARK --- session ---");
        this.$s = Date.now();
    }
    (this.server.config.log == "debug") && console.log("REQUEST "+this.request.headers["content-type"]);
    (this.server.config.log == "debug") && console.log("REQUEST "+this.request.headers["authorization"]);
    var lock = 2;
    // TODO Select crypto facility by content-type
    this.crypto = this.server.createCryptoFacility(this.server.config.crypto[0]);
    // TODO Select storage facility by selector
    this.storage = this.server.createStorageFacility(this.server.config.storage.name, this.server.config.storage.options);
    this.storage.connect(delegate.bind(this));
    this.request.addListener("data", receive.bind(this));
    this.request.addListener("end", delegate.bind(this));
    if (this.$benchmark) {
        var s = Date.now();
        this.request.addListener("end", function() {
            var d = Date.now()-s;
            console.log("BENCHMARK receive took "+d+" ms");
            console.log("BENCHMARK receive size: "+this.requestText.length+" B");
            console.log("BENCHMARK receive speed: "+(this.requestText.length/d)+" kB/s");
        }.bind(this));
    }
    if (this.$benchmark) console.log("BENCHMARK session run() end "+(Date.now()-this.$s)+" ms");

    function receive(chunk) {
        this.requestText += chunk;
    }

    function delegate(error) {
        if (error)
            return this.abort(error);
        if (--lock)
            return;
        (this.server.config.log == "debug") && console.log("REQUEST "+this.requestText);
        this.delegate();
    }

}

exports.prototype.delegate = function() {
    if (this.$benchmark) console.log("BENCHMARK session delegate() start "+(Date.now()-this.$s)+" ms");
    var hook;
    hook = this.selector.hook.match(/^\/!/) ? this.selector.hook : "*";
    if (!this.HookHandlers[hook])
        return this.abort(new HttpError(404, "hook not found"));
    if (typeof this.HookHandlers[hook][this.request.method] !== "function")
        return this.abort(new HttpError(501, "missing method"));
    this.HookHandlers[hook][this.request.method](this);
}

exports.prototype.end = function(status) {
    if (this.$benchmark) console.log("BENCHMARK session end() start "+(Date.now()-this.$s)+" ms");
    this.response.statusCode = status||200;
    this.response.write(this.$responseText||"", "utf8");
    this.response.end();
    if (this.storage)
        this.storage.disconnect();
    (this.server.config.log == "debug") && console.log("RESPONSE "+this.$responseText);
    (this.server.config.log == "debug") && console.log("RESPONSE "+this.response.getHeader("Content-Type"));
    (this.server.config.log == "debug") && console.log("RESPONSE "+this.response.getHeader["Authorization"]);
    if (this.$benchmark) console.log("BENCHMARK session end() end "+(Date.now()-this.$s)+" ms");
}

exports.prototype.abort = function(error) {
    try {
        if (error instanceof HttpError) {
            console.warn("ABORT "+error.toString());
            this.end(error.code);
        }
        else {
            throw error;
        }
    }
    catch(e) {
        try {
            console.error("ERROR "+e);
            this.end(500);
        }
        catch (ee) {
            console.error("DIZZY "+ee);
        }
        finally {
            //if (this.listeners('error').length)
                this.emit("error", e);
        }
    }
}

exports.prototype.write = function(data, type) {
    if (type && !this.response.headersSent)
        this.response.setHeader("Content-Type", type);
    if (data)
        this.$responseText = data;
}

exports.prototype.writeJson = function(data, type) {
    if (data!==undefined)
        var json = JSON.stringify(data);
    this.write(json, type||"application/json;charset=UTF-8");
}

Object.defineProperty(exports.prototype, "requestJson", {
    get: function() {
        if (this.$requestJson === undefined)
            this.$requestJson = this.requestText ? JSON.parse(this.requestText) : null;
        return this.$requestJson;
    }
});

Object.defineProperty(exports.prototype, "selector", {
    get: function() {
        var purl;
        if (this.$selector === undefined) {
            purl = this.request.url.split('?');
            this.$selector = new Array();
            this.$selector.hook = purl[0].replace(/([^\/\?!]+)(?:\/([^\/\?!]+))?/g, function(m, p1, p2) {
                this.$selector.push({
                    'key': p1||null,
                    'value': p2||null
                });
                return p1;
            }.bind(this));
            this.$selector.last = this.$selector[this.$selector.length-1];
            this.$selector.query = purl[1];
        }
        return this.$selector;
    }
});

Object.defineProperty(exports.prototype, "type", {
    get: function() {
        if (this.$type === undefined) {
            this.$type = null;
            if (this.request.headers['content-type']) {
                this.$type = {
                    'name': null,
                    'options': {}
                };
                this.$type.name = this.request.headers['content-type'].replace(/;\s*([^;=]*)\s*=\s*([^;]*)\s*/g, function(m, p1, p2) {
                    if (p1.length)
                        this.$type.options[p1] = p2;
                    return "";
                }.bind(this));
            }
        }
        return this.$type;
    }
});

Object.defineProperty(exports.prototype, "authorization", {
    get: function() {
        if (this.$authorization === undefined) {
            this.$authorization = this.request.headers['authorization'] || null;
            if (this.$authorization) {
                this.$authorization = this.$authorization.match(/(\w+):([A-Za-z0-9\+\/]+={0,2}):([A-Za-z0-9\+\/]+={0,2}):([A-Za-z0-9\+\/]+={0,2}):([\w-]+)/)
                if (this.$authorization) {
                    this.$authorization = {
                        'realm': this.$authorization[1],
                        'id': this.$authorization[2],
                        'vec': this.$authorization[3],
                        'sig': this.$authorization[4],
                        'crypto': this.$authorization[5],
                        'length': this.$authorization[0].length
                    };
                }
            }
        }
        return this.$authorization;
    }
});
