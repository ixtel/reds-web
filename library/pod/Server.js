var Server = require("../shared/Server");

module.exports = exports = function(config, Session) {
	Server.call(this, config, Session);
}

exports.prototype = Object.create(Server.prototype);

exports.prototype.listen = function(request, response) {
	try {
		console.log(process.pid +" LISTEN "+request.method+" "+request.url); // DEBUG
		that.response.setHeader("Pragma", "no-cache");
		that.response.setHeader("Cache-Control", "no-cache");
		that.response.setHeader("Expires", "-1");
		Server.prototype.listen.call(this, request, response);
	}
	catch (e) {
		this.disconnect(e);
	}
}
