var Server = require("../shared/Server");

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

exports.prototype.listen = function(request, response) {
	try {
		console.log("REDS Node");
		if (this.config.cors) {
			response.setHeader('Access-Control-Allow-Origin', this.config.cors.origin);
			if (request.method == 'OPTIONS') {
				response.setHeader('Access-Control-Allow-Methods', this.config.cors.origin);
				response.setHeader('Access-Control-Allow-Headers', this.config.cors.headers);
				response.end();
			}
		}
		console.info(process.pid +" LISTEN "+request.method+" "+request.url); // DEBUG
		response.end(Math.floor(Math.random()*1000).toString());
	}
	catch (e) {
		this.disconnect(e);
	}
}
