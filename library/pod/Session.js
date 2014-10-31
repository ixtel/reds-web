"use strict";

var Session = require("../shared/Session");

module.exports = exports = function(config, request, response) {
	Session.call(this, config, request, response);
}

exports.prototype = Object.create(Session.prototype);

exports.prototype.HookHandlers = {
	'/!/domain': require("./hooks/domain.js"),
	'/!/domain/ticket': require("./hooks/ticket.js"),
	'*': require("./hooks/entity.js")
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
