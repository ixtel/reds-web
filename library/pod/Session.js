"use strict";

var Session = require("../shared/Session");
var HttpError = require("../shared/HttpError");
var TemporaryStorage = require("./TemporaryStorage");


module.exports = exports = function(config, request, response) {
	Session.call(this, config, request, response);
}

exports.prototype = Object.create(Session.prototype);

// TODO Make ttl and ttd configurable
exports.prototype.leafs = new TemporaryStorage(30000, 5000);

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
		var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.authorization['vec'], this.authorization['crypto'], this.request.method, this.request.headers['content-type'], this.requestText||"");
		var sig = this.crypto.generateHmac(msg, result['dkey']);
		if (sig == this.authorization['sig'])
			return callback();
		else
			return callback(new HttpError(403, "Invalid authorization"));
	}
}

exports.prototype.authorizeTicket = function(callback) {
	var leaf, domain, ticket;
	if (!this.authorization)
		return callback(new HttpError(401, "Missing authorization"));
	// NOTE Note this check won't be needed once the session can handle multiple facilities
	if (this.authorization['crypto'] != this.crypto.name)
		return callback(new HttpError(400, "Unsupported crypto facility"));
	if (this.authorization['realm'] != "ticket")
		return callback(new HttpError(400, "Invalid realm"));
	leaf = this.leafs.getItem(this.authorization['id']);
	if (!leaf)
		return callback(new HttpError(412, "Unknown leaf"));
	this.storage.readDomain(leaf['did'], afterReadDomain.bind(this));

	function afterReadDomain(error, result) {
		var tid;
		if (error)
			return callback(error);
		if (!result)
			return callback(new HttpError(403, "Unknown domain"));
		domain = result;
		tid = this.crypto.decryptData(this.authorization['vec'], domain['dkey'], leaf['vec']);
		this.storage.readTicket(tid, afterReadTicket.bind(this));
	}

	function afterReadTicket(error, result) {
		var key;
		if (error)
			return callback(error);
		if (!result)
			return callback(new HttpError(403, "Unknown ticket"));
		ticket = result;
		key = this.crypto.generateHmac(ticket['tkey'], leaf['vec']);
		var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.authorization['vec'], this.authorization['crypto'], this.request.method, this.request.headers['content-type'], this.requestText||"");
		var sig = this.crypto.generateHmac(msg, key);
		if (sig != this.authorization['sig'])
			return callback(new HttpError(403, "Invalid authorization"));
		this.authorization['leaf'] = leaf;
		this.authorization['domain'] = domain;
		this.authorization['ticket'] = ticket;
		callback();
	}
}

exports.prototype.signTicket = function(credentials) {
	var key, tid, msg, sig;
	key = this.crypto.generateHmac(this.authorization.ticket['tkey'], this.authorization.leaf['vec']);
	tid = this.crypto.encryptData(this.authorization.ticket['tid'], this.authorization.domain['dkey'], this.authorization.leaf['vec']);
	msg = this.crypto.concatenateStrings("ticket", this.authorization['id'], tid, this.crypto.name, this.response.getHeader("Content-Type"), this.$responseText);
	sig = this.crypto.generateHmac(msg, key);
	this.response.setHeader("Authorization", "ticket:"+this.authorization['id']+":"+tid+":"+sig+":"+this.crypto.name);
}

exports.prototype.writeDomain = function(data, type) {
	if (data!==undefined)
		var json = JSON.stringify(data);
	this.write(json, type||"application/x.reds.domain;XX=1;did="+this.type.options['did']);
}

Object.defineProperty(exports.prototype, "requestDomain", {
	get: function() {
		if (this.$requestJson === undefined)
			this.$requestJson = this.requestText ? JSON.parse(this.requestText) : null;
		return this.$requestJson;
	}
});
