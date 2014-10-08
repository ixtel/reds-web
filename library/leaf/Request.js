(function(){
"use strict";

var HttpError = window.reds ? reds.HttpError : require("../shared/HttpError");

// INFO Leaf client module

var Request = function(crypto) {
	this.$responseJson = undefined;
	this.$xhr = new XMLHttpRequest();
	this.$xhr.addEventListener("load", this.$onLoad.bind(this), false);
	this.crypto = crypto;
	this.credentials = null;
	this.responseType = null;
	this.responseOptions = null;
}

Request.prototype.$onLoad = function(evt) {
	var error, type, options;
	if (this.$xhr.status >= 400) {
		evt.stopImmediatePropagation();
		error = new HttpError(this.$xhr.status, this.$xhr.statusText);
		this.dispatchEvent(new CustomEvent("error", {'detail':error}));
	}
	else if (type = this.$xhr.getResponseHeader("Content-Type")) {
		options = new Object();
		this.responseType = type.replace(/;\s*([^;=]*)\s*=\s*([^;=]*)\s* /, function(m, p1, p2) {
			if (p1.length)
				options[p1] = p2;
			return "";
		});
		this.responseOptions = options;
	}
}

Request.prototype.addEventListener = function(type, listener, useCapture) {
	return this.$xhr.addEventListener(type, listener, useCapture);
}

Request.prototype.removeEventListener = function(type, listener, useCapture) {
	return this.$xhr.removeEventListener(type, listener, useCapture);
}

Request.prototype.dispatchEvent = function(evt) {
	return this.$xhr.dispatchEvent(evt);
}

Request.prototype.open = function(method, url, path) {
	this.method = method;
	this.path = path;
	return this.$xhr.open(method, url+path, true);
}

Request.prototype.sign = function(credentials) {
	this.credentials = credentials;
}

Request.prototype.send = function(data, type) {
	var time, msg, sig;
	this.dispatchEvent(new Event("send"));
	if (type)
		this.$xhr.setRequestHeader("Content-Type", type);
	if (this.credentials) {
		time = this.crypto.generateTimestamp();
		msg = this.crypto.concatenateStrings(this.crypto.name, this.credentials['id'], this.method, this.path, type, data, time);
		sig = this.crypto.generateHmac(msg, this.credentials['auth']);
		this.$xhr.setRequestHeader("Authorization", this.crypto.name+":"+this.credentials['id']+":"+sig+":"+time);
	}
	return this.$xhr.send(data);
}

Request.prototype.sendJson = function(data, type) {
	var json, error;
	if (data !== undefined) {
		try {
			json = JSON.stringify(data);
		}
		catch (e) {
			error = new Error("request contains invalid JSON");
			this.dispatchEvent(new CustomEvent("error", {'detail':error}));
			return;
		}
	}
	this.send(json, type||"application/json;charset=UTF-8");
}

Object.defineProperty(Request.prototype, "responseJson", {
	get: function() {
		var error;
		if (this.$responseJson === undefined) {
			try {
				this.$responseJson = this.$xhr.responseText ? JSON.parse(this.$xhr.responseText) : null;
			}
			catch (e) {
				error = new Error("response contains invalid JSON");
				this.dispatchEvent(new CustomEvent("error", {'detail':error}));
				return;
			}
		}
		return this.$responseJson;
	}
});

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Request=Request;

})();
