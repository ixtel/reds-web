"use strict";

var events = require("events");
var FacilityManager = require("./FacilityManager");
var HttpError = require("./HttpError");

var CryptoFacilities = new FacilityManager();
CryptoFacilities.addFacility(require("./crypto/CryptoJs"));
CryptoFacilities.addFacility(require("./crypto/Sjcl"));

var StorageFacilities = new FacilityManager();
StorageFacilities.addFacility(require("./storage/NodePg.js"));

module.exports = exports = function(config, request, response) {
	events.EventEmitter.call(this);
	this.$requestJson = undefined;
	this.$selector = undefined;
	this.$type = undefined;
	this.config = config;
	this.request = request;
	this.response = response;
	this.requestText = '';
	// NOTE Will be set in run()
	this.crypto = null;
	this.storage = null;
}

exports.prototype = Object.create(events.EventEmitter.prototype);

exports.prototype.HookHandlers = null;

CryptoFacilities.addFactoryToObject("createCryptoFacility", exports.prototype);
StorageFacilities.addFactoryToObject("createStorageFacility", exports.prototype);

exports.prototype.run = function() {
	console.log("REQUEST "+this.request.headers["content-type"]); // DEBUG
	var lock = 2;
	// TODO Select crypto facility by content-type
	this.crypto = this.createCryptoFacility(this.config.crypto[0]);
	// TODO Select storage facility by selector
	this.storage = this.createStorageFacility(this.config.storage.name, this.config.storage.options);
	this.storage.connect(delegate.bind(this));
	this.request.addListener("data", receive.bind(this));
	this.request.addListener("end", delegate.bind(this));

	function receive(chunk) {
		this.requestText += chunk;
	}

	function delegate() {
		if (--lock)
			return;
		console.log("REQUEST "+this.requestText); // DEBUG
		this.delegate();
	}
}

exports.prototype.delegate = function() {
	var hook;
	hook = this.selector.hook.match(/^\/!/) ? this.selector.hook : "*";
	if (!this.HookHandlers[hook])
		return this.abort(new HttpError(404, "hook not found"));
	if (typeof this.HookHandlers[hook][this.request.method] !== "function")
		return this.abort(new HttpError(501, "missing method"));
	this.HookHandlers[hook][this.request.method](this);
}

exports.prototype.end = function(status) {
	this.response.statusCode = status||200;
	this.response.end();
	if (this.storage)
		this.storage.disconnect();
	console.log("RESPONSE "+this.response.getHeader("Content-Type")); // DEBUG
}

exports.prototype.abort = function(error) {
	try {
		if (error instanceof HttpError) {
			console.warn("ABORT "+error.toString());
			if  (error.code == 401)
				this.response.setHeader("WWW-Authenticate", "REDS realm=\"node\"");
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
			this.emit("error", e);
		}
	}
}

exports.prototype.write = function(data, type) {
	if (type && !this.response.headersSent)
		this.response.setHeader("Content-Type", type);
	if (data)
		this.response.write(data, "utf8");
	console.log("RESPONSE "+data); // DEBUG
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
		if (this.$selector === undefined) {
			this.$selector = new Array();
			this.$selector.hook = this.request.url.replace(/([^\/\?!]+)(?:\/([^\/\?!]+))?/g, function(m, p1, p2) {
				this.$selector.push({
					'key': p1||null,
					'value': p2||null
				});
				this.$selector.last = this.$selector[this.$selector.length-1];
				return p1;
			}.bind(this));
		}
		return this.$selector;
	}
});

Object.defineProperty(exports.prototype, "type", {
	get: function() {
		if (this.$type === undefined) {
			this.$type = {
				'name': null,
				'options': {}
			};
			if (this.request.headers['content-type']) {
				this.$type.name = this.request.headers['content-type'].replace(/;\s*([^;=]*)\s*=\s*([^;=]*)\s*/, function(m, p1, p2) {
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
				this.$authorization = this.$authorization.match(/(account|domain|ticket):(\d+):([A-Za-z0-9\+\/]+={0,2}):([A-Za-z0-9\+\/]+={0,2}):([\w-]+)/)
				if (this.$authorization) {
					this.$authorization = {
						'realm': this.$authorization[1],
						'id': parseInt(this.$authorization[2]),
						'signature': this.$authorization[3],
						'time': this.$authorization[4],
						'crypto': this.$authorization[5]
					};
				}
			}
		}
		return this.$authorization;
	}
});
