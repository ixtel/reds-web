"use strict";

var Session = require("../shared/Session");
var HttpError = require("../shared/HttpError");
var TemporaryStorage = require("./TemporaryStorage");


module.exports = exports = function(config, request, response) {
	Session.call(this, config, request, response);
}

exports.prototype = Object.create(Session.prototype);

// TODO Make ttl and ttd configurable
exports.prototype.leafs = new TemporaryStorage(600000, 60000);

exports.prototype.HookHandlers = {
	'/!/domain': require("./hooks/domain.js"),
	'/!/domain/ticket': require("./hooks/ticket.js"),
	'/!/domain/leaf': require("./hooks/leaf.js"),
	'*': require("./hooks/entity.js")
}

exports.prototype.authorizeDomain = function(callback) {
	if (!this.authorization)
		return callback(new HttpError(401, "Missing authorization"));
	// NOTE Note this check won't be needed once the session can handle multiple facilities
	if (this.authorization['crypto'] != this.crypto.name)
		return callback(new HttpError(400, "Unsupported crypto facility"));
	if (this.authorization['realm'] != "domain")
		return callback(new HttpError(400, "Invalid realm"));
	this.storage.readDomain(this.authorization['id'], afterReadDomain.bind(this));

	function afterReadDomain(error, result) {
		if (error)
			return callback(error);
		if (!result)
			return callback(new HttpError(403, "Unknown domain"));
		var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.request.method, this.request.headers['content-type'], this.requestText||"", this.authorization['time'], this.authorization['crypto']);
		var sig = this.crypto.generateHmac(msg, result['dkey']);
		if (sig == this.authorization['signature'])
			return callback();
		else
			return callback(new HttpError(403, "Invalid authorization"));
	}
}

exports.prototype.writeDomain = function(data, type) {
	if (data!==undefined)
		var json = JSON.stringify(data);
	this.write(json, type||"application/x.reds.domain;did="+this.type.options['did']);
}

Object.defineProperty(exports.prototype, "requestDomain", {
	get: function() {
		if (this.$requestJson === undefined)
			this.$requestJson = this.requestText ? JSON.parse(this.requestText) : null;
		return this.$requestJson;
	}
});
