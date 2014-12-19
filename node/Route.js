"use strict";

var events = require('events');
var http = require("http");
var HttpError = require("../shared/HttpError");

module.exports = exports = function(crypto, storage) {
    events.EventEmitter.call(this);
    this.$data = "";
    this.$responseJson = undefined;
    this.crypto = crypto;
    this.storage = storage;
    this.pod = null;
    this.method = null;
    this.path = null;
    this.requestHeaders = {'content-type':"application/octet-stream"};
    this.responseHeaders = null;
    this.responseText = null;
    this.responseType = null;
}

exports.prototype = Object.create(events.EventEmitter.prototype);

exports.prototype.init = function(pod) {
    this.storage.readPod(pod, afterReadPod.bind(this));

    function afterReadPod(error, result) {
        if (error)
            return this.emit("error", error)
        if (!result)
            return this.emit("error", new Error("unable to read pod"))
        this.pod = result;
        this.emit("ready");
    }
}

exports.prototype.resolve = function(did) {
    this.storage.resolvePod(did, afterResolvePod.bind(this));

    function afterResolvePod(error, result) {
        if (error)
            return this.emit("error", error)
        if (!result)
            return this.emit("error", new Error("unable to resolve pod"))
        this.pod = result;
        this.emit("ready");
    }
}

exports.prototype.writeJson = function(data, type) {
    var json, error;
    if (data !== undefined) {
        try {
            json = JSON.stringify(data);
        }
        catch (e) {
            error = new Error("request contains invalid JSON");
            this.emit("error", error);
            return;
        }
    }
    this.write(json, type||"application/json;charset=UTF-8");
}

exports.prototype.write = function(data, type) {
    if (this.$data.length)
        throw new Error("Multiple Route.write calls are not supported yet (TODO)");
    this.requestHeaders['content-type'] = type||"application/octet-stream";
    this.$data = data||"";
}

exports.prototype.send = function(data, authorization) {
    var match, request, header;
    match = this.pod.url.match(/([^\/:]+)(?:\:(\d+))?(.*)/);
    request = http.request({
        'hostname': match[1],
        'port': parseInt(match[2])||80,
        'method': this.method,
        'path': match[3]+this.path
    });
    request.addListener("error", onError.bind(this));
    request.addListener('response', onResponse.bind(this));
    if (this.pod['auth']) {
        var time, msg, sig;
        time = this.crypto.generateTimestamp();
        msg = this.crypto.concatenateStrings("node", this.pod['nid'], time, this.crypto.name, this.method, this.requestHeaders['content-type'], this.$data);
        sig = this.crypto.generateHmac(msg, this.pod['auth']);
        this.requestHeaders['authorization'] = "node:"+this.pod['nid']+":"+time+":"+sig+":"+this.crypto.name+":"+this.requestHeaders['authorization'];
    }
    for (header in this.requestHeaders)
        request.setHeader(header, this.requestHeaders[header]);
    request.setHeader("content-length", this.$data ? Buffer.byteLength(this.$data) : 0);
    request.end(this.$data);

    function onResponse(response) {
        var responseText = "";
        response.setEncoding('utf8');
    
        if (response.statusCode >= 400)
            return this.emit("error", new HttpError(response.statusCode, "pod returned error"));

        response.addListener("error", function(error) {
            this.emit("error", new HttpError(502, error.message));
        }.bind(this));

        response.addListener("data", function(chunk) {
            responseText += chunk;
        });

        response.addListener("end", function() {
            this.responseText = responseText;
            this.responseHeaders = response.headers;
            this.emit("response", this);
        }.bind(this));
    }

    function onError(error) {
        this.emit("error", new HttpError(502, error.message));
    }
}

Object.defineProperty(exports.prototype, "responseJson", {
    get: function() {
        if (this.$responseJson === undefined)
            this.$responseJson = this.responseText ? JSON.parse(this.responseText) : null;
        return this.$responseJson;
    }
});
