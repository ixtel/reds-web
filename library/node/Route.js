"use strict";

var events = require('events');
var http = require("http");
var HttpError = require("../shared/HttpError");

module.exports = exports = function(crypto, storage) {
	events.EventEmitter.call(this);
	this.$data = "";
	this.$type = "application/octet-stream";
	this.$responseJson = undefined;
	this.crypto = crypto;
	this.storage = storage;
	this.pod = null;
	this.method = null;
	this.path = null;
	this.responseText = null;
	this.responseType = null;
}

exports.prototype = Object.create(events.EventEmitter.prototype);

// TODO Handle unknown pod
exports.prototype.init = function(pod) {
	this.storage.readPod(pod, afterReadPod.bind(this));

	function afterReadPod(error, result) {
		if (error)
			return this.emit("error", error)
		this.pod = result;
		this.emit("ready");
	}
}

exports.prototype.resolve = function(did) {
	this.storage.readDomain(did, afterReadDomain.bind(this));

	function afterReadDomain(error, result) {
		if (error)
			return this.emit("error", error)
		this.init(result['pid']);
	}
}

exports.prototype.writeJson = function(data, type) {
	if (data!==undefined)
		var json = JSON.stringify(data);
	this.write(json, type||"application/json;charset=encoding");
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
	this.$type = type||"application/octet-stream";
	this.$data = data||"";
}

exports.prototype.send = function(data, type) {
	var m = this.pod.url.match(/([^\/:]+)(?:\:(\d+))?(.*)/);
	var req = http.request({
		'hostname': m[1],
		'port': parseInt(m[2])||80,
		'method': this.method,
		'path': m[3]+this.path
	});
	req.addListener("error", onError.bind(this));
	req.addListener('response', onResponse.bind(this));
	req.setHeader("content-length", this.$data ? Buffer.byteLength(this.$data) : 0);
	req.setHeader("content-type", this.$type);
	req.end(this.$data);

	function onResponse(response) {
		var responseText = "";
		response.setEncoding('utf8');
	
		if (response.statusCode >= 400)
			return this.emit("error", new HttpError(response.statusCode, "pod returned error"));

		response.addListener("error", function(error) {
			this.emit("error", error);
		}.bind(this));

		response.addListener("data", function(chunk) {
			responseText += chunk;
		});

		response.addListener("end", function() {
			this.responseText = responseText;
			this.responseType = response.headers['content-type'];
			this.emit("response", this);
		}.bind(this));
	}

	function onError(error) {
		this.emit("error", error);
	}
}

Object.defineProperty(exports.prototype, "responseJson", {
	get: function() {
		if (this.$responseJson === undefined)
			this.$responseJson = this.responseText ? JSON.parse(this.responseText) : null;
		return this.$responseJson;
	}
});
