var cluster = require("cluster");
var http = require("http");
var os = require("os");

module.exports = exports = function(config, Session) {
	this.hooks = new Object();
	this.config = config;
	this.Session = Session;

	if (this.config.workers == "cores")
		this.config.workers = os.cpus().length;
}

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
	
	for (var i = 0; i < this.config.workers; i++)
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
		var session = new this.Session(this.config, request, response);
		session.addListener("error", function(){response.end();});
		session.addListener("error", this.disconnect.bind(this));
		session.run();
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
