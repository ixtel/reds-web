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
	'*': require("./hooks/entity.js")
}

exports.prototype.authorize = function(callback) {
	if (!this.authorization)
		return callback(new HttpError(401, "Missing authorization"));
	// NOTE Note this check won't be needed once the session can handle multiple facilities
	if (this.authorization['crypto'] != this.crypto.name)
		return callback(new HttpError(500, "Unsupported crypto facility"));
	this.storage.readAccount(this.authorization['id'], afterReadAccount.bind(this));

	function afterReadAccount(error, result) {
		if (error)
			return callback(error);
		var msg = this.crypto.concatenateStrings(this.authorization['crypto'], this.authorization['id'], this.request.method, this.request.url, this.request.headers['content-type'], this.requestText||"", this.authorization['vector']);
		var sig = this.crypto.generateHmac(msg, result['auth']);
		if (sig == this.authorization['signature'])
			return callback();
		else
			return callback(new HttpError(403, "Invalid authorization"));
	}
}

Object.defineProperty(exports.prototype, "authorization", {
	get: function() {
		if (this.$authorization === undefined) {
			this.$authorization = this.request.headers['authorization'] || null;
			if (this.$authorization) {
				this.$authorization = this.$authorization.match(/aid:(\d+):([A-Za-z0-9\+\/]+={0,2}):([A-Za-z0-9\+\/]+={0,2}):([\w-]+)/)
				if (this.$authorization) {
					this.$authorization = {
						'id': this.$authorization[1],
						'signature': this.$authorization[2],
						'vector': this.$authorization[3],
						'crypto': this.$authorization[4]
					};
				}
			}
		}
		return this.$authorization;
	}
});
