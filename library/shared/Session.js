var domain = require("domain");
var events = require("events");
var SessionError = require("./SessionError");

module.exports = exports = function(config, request, response) {
	this.$requestJSON = undefined;
	this.$storageFacility = undefined;
	this.config = config;
	this.domain = null;
	this.purl = null;
	this.request = request;
	this.response = response;
	this.requestText = '';
	this.$setupDomain();
	this.$parseUrl();
}

exports.prototype = Object.create(events.EventEmitter.prototype);

exports.prototype.HookHandlers = null;
exports.prototype.StorageFacilities = null;

exports.prototype.$parseUrl = function() {
	var purl = new Array();
	purl.path = this.request.url.replace(/([^\/\?!]+)(?:\/([^\/\?!]+))?/g, function(m, p1, p2) {
		purl.push({
			'key': p1,
			'value': p2
		});
		return p1;
	});
	this.purl = purl;
}

exports.prototype.$setupDomain = function() {
	this.domain = domain.create();
	this.domain.add(this.request);
	this.domain.add(this.response);
	this.domain.addListener("error", this.abort.bind(this));
}

exports.prototype.run = function() {
	var lock = 2;
	this.domain.run(connect.bind(this));

	function connect() {
		if (!this.StorageFacilities[this.config.storage.facility])
			throw new Error("unknown storage facility");
		this.storage = new this.StorageFacilities[this.config.storage.facility](this.config.storage.options);
		this.storage.connect(this.domain.intercept(delegate.bind(this)));
		this.request.addListener("data", receive.bind(this));
		this.request.addListener("end", delegate.bind(this));
	}

	function receive(chunk) {
		this.requestText += chunk;
	}

	function delegate() {
		if (--lock)
			return;
		if (!this.HookHandlers[this.purl.path])
			throw new SessionError(404, "hook not found");
		if (typeof this.HookHandlers[this.purl.path][this.request.method] !== "function")
			throw new SessionError(501, "missing method");
		this.HookHandlers[this.purl.path][this.request.method](this);
	}
}

exports.prototype.end = function() {
	this.response.end();
	if (this.storage)
		this.storage.disconnect();
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

Object.defineProperty(exports.prototype, "storageFacility", {
	get: function() {
		if (this.$storageFacility === undefined) {
			var StorageFacilitiy = this.StorageFacilities[this.config.storage.facility];
			if (!StorageFacilitiy)
				throw new Error("unknown storage facility");
			this.$storageFacility = new StorageFacilitiy(this.config.storage.options);
		}
		return this.$storageFacility;
	}
});
