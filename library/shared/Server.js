var cluster = require("cluster");
var http = require("http");
var os = require("os");

module.exports = exports = function(config, Session) {
	this.config = config;
	this.httpd = null;
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
	// NOTE Restart the worker if it crashed
	// TODO Enable only for production
	cluster.addListener("exit", function(worker, code, signal) {
		console.info(worker.process.pid +" EXIT "+code+" "+signal);
		setTimeout(function(){cluster.fork()}, 5000);
	});
	
	for (var i = 0; i < this.config.workers; i++)
		cluster.fork();
}

exports.prototype.connect = function() {
	console.info(process.pid +" CONNECT "+this.config.host+" "+this.config.port);

	// NOTE Exit the worker instead of crashing node on exceptions
	// TODO Enable only for production
	process.addListener("uncaughtException", function(error) {
		try {
			console.error(process.pid +" EXCEPTION "+error);
			this.httpd.close();
			process.exit(1);
		}
		catch (e) {
			console.log("FATAL "+e);
			process.exit(2);
		}	
	}.bind(this));

	this.httpd = http.createServer();
	this.httpd.listen(this.config.port, this.config.host);
	this.httpd.addListener("request", this.listen.bind(this));
}

exports.prototype.listen = function(request, response) {
	console.info(process.pid +" LISTEN "+request.method+" "+request.url); // DEBUG
	response.end();
	return;
	var session = new this.Session(this.config, request, response);
	session.run();
}
