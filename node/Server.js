"use strict";

var Server = require("../shared/Server");
var NodeSession = require("./Session");

module.exports = exports = function(config, Session) {
	Server.call(this, config, Session||NodeSession);
}

exports.prototype = Object.create(Server.prototype);

exports.prototype.listen = function(request, response) {
	// TODO Activate CORS once the authorization header has been merged onto content-type
	/*if (this.config.cors) {
		response.setHeader('Access-Control-Allow-Origin', this.config.cors.origin);
		if (request.method == 'OPTIONS') {
			response.setHeader('Access-Control-Allow-Methods', this.config.cors.methods);
			response.setHeader('Access-Control-Allow-Headers', this.config.cors.headers);
			response.end();
			return;
		}
	}*/
	Server.prototype.listen.call(this, request, response);
}