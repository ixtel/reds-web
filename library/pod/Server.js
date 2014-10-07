"use strict";

var Server = require("../shared/Server");
var PodSession = require("./Session");

module.exports = exports = function(config, Session) {
	Server.call(this, config, Session||PodSession);
}

exports.prototype = Object.create(Server.prototype);
