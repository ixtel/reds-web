var events = require('events');
var http = require("http");
var HttpError = require("../shared/HttpError");

module.exports = exports = function(crypto, storage) {
	this.$responseJson = undefined;
	this.crypto = crypto;
	this.storage = storage;
	this.pod = null;
	this.method = null;
	this.path = null;
	this.responseText = null;
}

// TODO Handle unknown pod
exports.prototype.init = function(pod, callback) {
	this.storage.readPod(pod, afterReadPod.bind(this));

	function afterReadPod(error, result) {
		this.pod = result;
		callback(error||null);
	}
}

exports.prototype.sendJson = function(data, callback, type) {
	if (data !== undefined) {
		try {
			var json = JSON.stringify(data);
		}
		catch (e) {
			var error = new Error("request contains invalid JSON");
			return callback(error);
		}
	}
	this.send(json, callback, type||"application/json;charset=encoding");
}

exports.prototype.send = function(data, callback, type) {
	var m = this.pod.url.match(/([^\/:]+)(?:\:(\d+))?(.*)/);
	var req = http.request({
		'hostname': m[1],
		'port': parseInt(m[2])||80,
		'method': this.method,
		'path': m[3]+this.path
	});
	req.addListener('response', onResponse.bind(this));
	req.setHeader("content-length", data ? Buffer.byteLength(data) : 0);
	req.end(data);

	function onResponse(response) {
		var responseText = "";
		response.setEncoding('utf8');
	
		if (response.statusCode >= 400)
			return callback(new HttpError(response.statusCode, "pod returned error"));

		response.addListener("data", function(chunk) {
			responseText += chunk;
		});

		response.addListener("end", function() {
			this.responseText = responseText;
			callback(null, this);
		}.bind(this));
	}
}

Object.defineProperty(exports.prototype, "responseJson", {
	get: function() {
		if (this.$responseJson === undefined) {
			try {
				this.$responseJson = this.responseText ? JSON.parse(this.responseText) : null;
			}
			catch (e) {
				// TODO Handle by event
				throw new HttpError(400, "route response contains invalid JSON");
			}
		}
		return this.$responseJson;
	}
});
