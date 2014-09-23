var Server = require("../shared/Server");
var PodSession = require("./Session");

module.exports = exports = function(config, Session) {
	Server.call(this, config, Session||PodSession);
}

exports.prototype = Object.create(Server.prototype);

exports.prototype.listen = function(request, response) {
	response.setHeader("Pragma", "no-cache");
	response.setHeader("Cache-Control", "no-cache");
	response.setHeader("Expires", "-1");
	Server.prototype.listen.call(this, request, response);
}
