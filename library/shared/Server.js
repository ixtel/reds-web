var cluster = require("cluster");
var http = require("http");
var os = require("os");

module.exports = exports = function(config) {
	this.hooks = new Object();
	this.config = config;
	if (!this.config.forks)
		this.config.forks = 1;
	else if (this.config.forks == "cores")
		this.config.forks = os.cpus().length;
}

exports.prototype.Session = null;

exports.prototype.run = function() {
	if (cluster.isMaster)
		this.setup();
	else
		this.connect();
}

exports.prototype.setup = function() {
	cluster.addListener("exit", function(worker, code, signal) {
		console.info(worker.process.pid +" EXIT "+code+" "+signal);
	});

	cluster.addListener("disconnect", function(worker) {
		// NOTE Since ondisconnect is triggerd by worker.disconnect() and
		//      process.exit(), we only fork a new worker if the old worker
		//      killed itself via diconnect(). Otherwise we assume an
		//      unresolvable error and don't respawn. 
		if (worker.suicide)
			cluster.fork();
	});
	
	for (var i = this.config.forks; i > 0; i--)
		cluster.fork();
}

exports.prototype.connect = function() {
	console.info(process.pid +" CONNECT "+this.config.host+" "+this.config.port);
	global.httpd = http.createServer();
	global.httpd.listen(this.config.port, this.config.host, function(error) {
		if (error)
			this.fatal(error);
	 	global.httpd.addListener("error", this.disconnect.bind(this));
	 	global.httpd.addListener("request", this.listen.bind(this));
	}.bind(this));
}

exports.prototype.listen = function(request, response) {
	try {
		console.info(process.pid +" LISTEN "+request.method+" "+request.url); // DEBUG
		response.end();
	}
	catch (e) {
		this.disconnect(e);
	}
}

exports.prototype.disconnect = function(error) {
	try {
		console.warn(process.pid +" DISCONNECT");
		console.log(error); // DEBUG
		setTimeout(function(){process.exit(2);}, 5000).unref();
		global.httpd.close();
		cluster.worker.disconnect();
	}
	catch (e) {
		this.fatal(e);
	}
}

exports.prototype.fatal = function(error) {
	console.error(process.pid +" FATAL");
	console.log(error); // DEBUG
	process.exit(1);
}