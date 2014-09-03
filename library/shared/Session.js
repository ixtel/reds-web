var domain = require("domain");
var events = require("events");
var SessionError = require("./SessionError");

module.exports = exports = function(config, request, response) {
	this.$requestJSON = undefined;
	this.$storage = new Object();
	this.config = config;
	this.domain = null;
	this.request = request;
	this.response = response;
	this.requestText = '';
}

exports.prototype = Object.create(events.EventEmitter.prototype);

exports.prototype.HookHandlers = null;
exports.prototype.StorageFacilities = null;

exports.prototype.setup = function() {
	this.domain = domain.create();
	this.domain.add(this.request);
	this.domain.add(this.response);
	this.domain.addListener("error", this.abort.bind(this));
	this.domain.run(this.start.bind(this));
}

exports.prototype.start = function() {
	this.request.addListener("data", function(chunk) {
		this.requestText += chunk;
	}.bind(this));

	this.request.addListener("end", function() {
		console.log("DEBUG request type: "+this.request.headers["content-type"]); // DEBUG
		console.log("DEBUG request data: "+this.requestText); // DEBUG
		this.run();
	}.bind(this));
}

exports.prototype.run = function() {
	var path = "user";
	if (!this.HookHandlers[path])
		throw new SessionError(404, "hook not found");
	var hook = new this.HookHandlers[path](this);
	if (typeof hook[this.request.method] !== "function")
		throw new SessionError(501, "missing method");
	hook[this.request.method]();
}

exports.prototype.end = function() {
	var counter = 1;
	for (var facility in this.$storage)
		disconnect.call(this, facility);
	if (--counter == 0)
		finalize.call(this);

	function disconnect(facility) {
		counter++;
		this.$storage[facility].disconnect(function(error) {
			if (--counter <= 0) {
				if (!error) {
					counter = 0;
					throw error;
				}
				delete this.$storage[facility];
				if (counter == 0)
					finalize.call(this);
			}
		}.bind(this));
	}

	function finalize() {
		this.response.end();
	}
}

exports.prototype.abort = function(error) {
	try {
		if (error instanceof SessionError) {
			console.info("ABORT "+error.toString());
			if  (error.code == 401)
				this.response.setHeader("WWW-Authenticate", "REDS realm=\"node\"");
			this.response.statusCode = error.code;
			this.end();
		}
		else {
			throw error;
		}
	}
	catch (e) {
		try {
			console.warn("ERROR "+e);
			this.response.statusCode = 500;
			this.end();
		}
		catch (ee) {
			console.error("DIZZY "+ee);
			// TODO We should tell the admin about that
		}
		finally {
			if (this.listeners("error").length)
				this.emit("error", e);
			else
				throw e;
		}
	}
}

exports.prototype.storage = function(facility) {
	if (this.$storage[facility])
		return this.$storage[facility];
	if (!this.StorageFacilities[facility])
		throw new Error("Unknown storage facility '"+facility+"'");
	this.$storage[facility] = new this.StorageFacilities[facility](this.config.storage[facility]);
	return this.$storage[facility];
}

exports.prototype.write = function(data, type) {
	console.log("DEBUG response type: "+type); // DEBUG
	console.log("DEBUG response data: "+data); // DEBUG
	if (type && !this.response.headersSent)
		this.response.setHeader("Content-Type", type);
	if (data)
		this.response.write(data, "utf8");
}

exports.prototype.writeJSON = function(data, type) {
	if (data!==undefined)
		var json = JSON.stringify(data);
	this.write(json, type||"application/json;charset=utf8");
}

Object.defineProperty(exports.prototype, "requestJSON", {
	get: function() {
		if (this.$requestJSON === undefined) {
			try {
				this.$requestJSON = this.requestText ? JSON.parse(this.requestText) : null;
			}
			catch (e) {
				throw new SessionError(400, "request contains invalid JSON");
			}
		}
		return this.$requestJSON;
	}
});
