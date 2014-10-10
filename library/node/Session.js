"use strict";

var Session = require("../shared/Session");
var HttpError = require("../shared/HttpError");

module.exports = exports = function(config, request, response) {
	Session.call(this, config, request, response);
}

exports.prototype = Object.create(Session.prototype);

exports.prototype.HookHandlers = {
	'/!/account': require("./hooks/account"),
	'/!/domain': require("./hooks/domain")
}

exports.prototype.authorize = function(callback) {
	var authorization = this.request.headers['authorization']
	if (!authorization)
		return callback(new HttpError(401, "Missing authorization"));
	authorization = authorization.split(":");
	// NOTE Note this check won't be needed once the session can handle multiple facilities
	if (authorization[0] != this.crypto.name)
		return callback(new HttpError(500, "Unsupported crypto facility"));
	this.storage.readAccount(authorization[1], afterReadAccount.bind(this));

	function afterReadAccount(error, result) {
		if (error)
			return callback(error);
		var msg = this.crypto.concatenateStrings(authorization[0], authorization[1], this.request.method, this.request.url, this.request.headers['content-type'], this.requestText, authorization[3]);
		var sig = this.crypto.generateHmac(msg, result['auth']);
		if (sig == authorization[2])
			return callback();
		else
			return callback(new HttpError(403, "Invalid authorization"));
	}
}
