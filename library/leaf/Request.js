(function(){
"use strict";

var HttpError = window.reds ? reds.HttpError : require("../shared/HttpError");

// INFO Leaf client module

var Request = function(crypto) {
	this.$method = "";
	this.$type = "application/octet-stream";
	this.$data = "";
	this.$responseDomain = undefined;
	this.$responseJson = undefined;
	this.$xhr = new XMLHttpRequest();
	this.$xhr.addEventListener("load", this.$onLoad.bind(this), false);
	this.crypto = crypto;
	this.credentials = null;
	this.responseType = null;
}

Request.prototype.$onLoad = function(evt) {
	var error, type, options;
	if (this.$xhr.status >= 400) {
		evt.stopImmediatePropagation();
		error = new HttpError(this.$xhr.status, this.$xhr.statusText);
		this.dispatchEvent(new CustomEvent("error", {'detail':error}));
		return;
	}
	if (type = this.$xhr.getResponseHeader("Content-Type")) {
		options = new Object();
		type = type.replace(/;\s*([^;=]*)\s*=\s*([^;=]*)\s*/, function(m, p1, p2) {
			if (p1.length)
				options[p1] = p2;
			return "";
		});
	}
	this.responseType = {
		'type': type||null,
		'options': options||null
	};
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

Request.prototype.open = function(method, node, path) {
	this.$method = method;
	return this.$xhr.open(method, node+path, true);
}

Request.prototype.writeDomain = function(data, credentials, type) {
	var domain, error;
	if (data !== undefined) {
		try {
			domain = JSON.stringify(data);
		}
		catch (e) {
			error = new Error("request contains invalid JSON");
			this.dispatchEvent(new CustomEvent("error", {'detail':error}));
			return;
		}
	}
	this.write(domain, type||"application/x.reds.domain;did="+credentials['did']);
}

Request.prototype.writeJson = function(data, type) {
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
	this.write(json, type||"application/json;charset=UTF-8");
}

Request.prototype.write = function(data, type) {
	if (this.$data.length)
		throw new Error("Multiple Request.write calls are not supported yet (TODO)");
	this.$type = type||"application/octet-stream";
	this.$data = data||"";
}

Request.prototype.signAccount = function(credentials) {
	var time, msg, sig;
	time = this.crypto.generateTimestamp();
	msg = this.crypto.concatenateStrings("account", credentials['aid'], time, this.crypto.name, this.$method, this.$type, this.$data);
	sig = this.crypto.generateHmac(msg, credentials['akey']);
	this.$xhr.setRequestHeader("Authorization", "account:"+credentials['aid']+":"+time+":"+sig+":"+this.crypto.name);
}

Request.prototype.signDomain = function(credentials) {
	var time, msg, sig;
	time = this.crypto.generateTimestamp();
	msg = this.crypto.concatenateStrings("domain", credentials['did'], time, this.crypto.name, this.$method, this.$type, this.$data);
	sig = this.crypto.generateHmac(msg, credentials['dkey']);
	this.$xhr.setRequestHeader("Authorization", "domain:"+credentials['did']+":"+time+":"+sig+":"+this.crypto.name);
}

Request.prototype.signTicket = function(credentials) {
	var key, tid, msg, sig;
	key = this.crypto.generateHmac(credentials['tkey'], credentials['vec']);
	tid = this.crypto.encryptData(credentials['tid'], credentials['dkey'], credentials['vec']);
	msg = this.crypto.concatenateStrings("ticket", credentials['lid'], tid, this.crypto.name, this.$method, this.$type, this.$data);
	sig = this.crypto.generateHmac(msg, key);
	this.$xhr.setRequestHeader("Authorization", "ticket:"+credentials['lid']+":"+tid+":"+sig+":"+this.crypto.name);
}

Request.prototype.send = function() {
	this.dispatchEvent(new Event("send"));
	this.$xhr.setRequestHeader("Content-Type", this.$type);
	// NOTE Sending the data as a blob prevents Firefox (and maybe other browsers)
	//      from adding a charset value to the content-type header.
	return this.$xhr.send(new Blob([this.$data]));
}

Object.defineProperty(Request.prototype, "responseDomain", {
	get: function() {
		var error;
		if (this.$responseDomain === undefined) {
			try {
				this.$responseDomain = this.$xhr.responseText ? JSON.parse(this.$xhr.responseText) : null;
			}
			catch (e) {
				error = new Error("response contains invalid JSON");
				this.dispatchEvent(new CustomEvent("error", {'detail':error}));
				return;
			}
		}
		return this.$responseDomain;
	}
});

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
