var Server = require("../shared/Server");
var NodeSession = require("./Session");

module.exports = exports = function(config) {
	Server.call(this, config);
	if (this.config.cors) {
		if (!this.config.cors.methods)
			this.config.cors.methods = "GET, POST, PUT, DELETE";
		if (!this.config.cors.headers)
			this.config.cors.headers = "Content-Type";
	}
}

exports.prototype = Object.create(Server.prototype);

exports.prototype.Session = NodeSession;

exports.prototype.listen = function(request, response) {
	try {
		console.log(process.pid +" LISTEN "+request.method+" "+request.url); // DEBUG
		response.setHeader("Pragma", "no-cache");
		response.setHeader("Cache-Control", "no-cache");
		response.setHeader("Expires", "-1");
		if (this.config.cors) {
			response.setHeader('Access-Control-Allow-Origin', this.config.cors.origin);
			if (request.method == 'OPTIONS') {
				response.setHeader('Access-Control-Allow-Methods', this.config.cors.origin);
				response.setHeader('Access-Control-Allow-Headers', this.config.cors.headers);
				response.end();
				return;
			}
		}
		var session = new this.Session(this.config, request, response);
		session.addListener("error", this.disconnect.bind(this));
		session.setup();
	}
	catch (e) {
		this.disconnect(e);
	}
}
