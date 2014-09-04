var Server = require("../shared/Server");

module.exports = exports = function(config) {
	Server.call(this, config);
}

exports.prototype = Object.create(Server.prototype);

exports.prototype.listen = function(request, response) {
	try {
		console.log(process.pid +" LISTEN "+request.method+" "+request.url); // DEBUG
		that.response.setHeader("Pragma", "no-cache");
		that.response.setHeader("Cache-Control", "no-cache");
		that.response.setHeader("Expires", "-1");
		var session = new this.Session(this.config, request, response);
		session.addListener("error", this.disconnect.bind(this));
		session.run();
	}
	catch (e) {
		this.disconnect(e);
	}
}
