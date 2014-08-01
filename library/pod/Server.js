var Server = require("../shared/Server");

module.exports = exports = function(config) {
	Server.call(this, config);
}

exports.prototype = Object.create(Server.prototype);

exports.prototype.listen = function(request, response) {
	try {
		console.log("REDS Pod");
		that.response.setHeader("Pragma", "no-cache");
		that.response.setHeader("Cache-Control", "no-cache");
		that.response.setHeader("Expires", "-1");
		console.log(process.pid +" LISTEN "+request.method+" "+request.url); // DEBUG
		response.end(Math.floor(Math.random()*1000).toString());
	}
	catch (e) {
		this.disconnect(e);
	}
}
