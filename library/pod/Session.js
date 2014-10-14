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
