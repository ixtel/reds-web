"use strict";

var Session = require("../shared/Session");
var HttpError = require("../shared/HttpError");

module.exports = exports = function(config, request, response) {
	Session.call(this, config, request, response);
}

exports.prototype = Object.create(Session.prototype);

exports.prototype.HookHandlers = {
	'/!/account': require("./hooks/account"),
	'/!/domain': require("./hooks/domain"),
	'/!/domain/ticket': require("./hooks/ticket.js"),
	'/!/domain/leaf': require("./hooks/leaf.js"),
	'*': require("./hooks/entity.js")
}

exports.prototype.authorizeAccount = function(callback) {
	if (!this.authorization)
		return callback(new HttpError(401, "Missing authorization"));
	// NOTE Note this check won't be needed once the session can handle multiple facilities
	if (this.authorization['crypto'] != this.crypto.name)
		return callback(new HttpError(400, "Unsupported crypto facility"));
	if (this.authorization['realm'] != "account")
		return callback(new HttpError(400, "Invalid realm"));
	this.storage.readAccount(this.authorization['id'], afterReadAccount.bind(this));

	function afterReadAccount(error, result) {
		if (error)
			return callback(error);
		if (!result)
			return callback(new HttpError(403, "Unknown account"));
		var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.request.method, this.request.headers['content-type'], this.requestText||"", this.authorization['time'], this.authorization['crypto']);
		var sig = this.crypto.generateHmac(msg, result['auth']);
		if (sig == this.authorization['signature'])
			return callback();
		else
			return callback(new HttpError(403, "Invalid authorization"));
	}
}
