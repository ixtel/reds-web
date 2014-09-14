(function(){
"use strict";

var FacilityManager = window.reds ? reds.FacilityManager : require("../shared/FacilityManager");
var HttpError = window.reds ? reds.HttpError : require("../shared/HttpError");

// INFO Credential database

var Credentials = new Object();

Credentials.registerClient = function() {
	var id = Math.floor(Math.random()*0xffffffff);
	while (Credentials[id])
		id = Math.floor(Math.random()*0xffffffff);
	Credentials[id] = new Object();
	return id;
}

Credentials.unregisterClient = function(id) {
	delete Credentials[id];
}

// INFO Leaf client module

var CryptoFacilities = new FacilityManager();
CryptoFacilities.addFacility(window.reds ? reds.crypto.CryptoJs : require("../shared/crypto/CryptoJs"));
CryptoFacilities.addFacility(window.reds ? reds.crypto.Sjcl : require("../shared/crypto/Sjcl"));

var Client = function(options) {
	this.id = Credentials.registerClient();
	this.crypto = this.createCryptoFacility(options.crypto[0]);
	this.options = options;
	console.log(this.id);
	// NOTE Hack to add DOM event handling to non-DOM object
	var eventTarget = document.createTextNode(null);
	this.addEventListener = eventTarget.addEventListener.bind(eventTarget);
	this.removeEventListener = eventTarget.removeEventListener.bind(eventTarget);
	this.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);
}

CryptoFacilities.addFinalFactoryToObject("createCryptoFacility", Client.prototype);

Client.prototype.sendJson = function(method, path, obj, callback) {
	try {
		var data = obj!==undefined ? JSON.stringify(obj) : undefined;
	}
	catch(error) {
		this.dispatchEvent(new CustomEvent("error", {'detail':error}));
		throw error;
	}
	this.send(method, path, "application/json;charset=encoding", data, callback);
}

Client.prototype.send = function(method, path, type, data, callback) {
	var xhr = new XMLHttpRequest();
	xhr.addEventListener("load", onLoad.bind(this), false);
	xhr.addEventListener("error", onError.bind(this), false);
	xhr.open(method, this.options.url+path, true);
	xhr.setRequestHeader("Content-Type", type);
	xhr.send(data);
	this.dispatchEvent(new Event("send"));

	function onLoad() {
		try {
			if (xhr.status >= 400)
				throw new HttpError(xhr.status, xhr.statusText);
			this.dispatchEvent(new Event("load"));
			var data = undefined;
			var options = new Object();
			var type = xhr.getResponseHeader("Content-Type").replace(/;\s*([^;=]*)\s*=\s*([^;=]*)\s*/, function(m, p1, p2) {
				if (p1.length)
					options[p1] = p2;
				return "";
			});
			switch(type) {
				case "application/json":
					data = JSON.parse(xhr.responseText);
					break;
				default:
					throw new Error("Unknown content-type '"+type+"'");
			}
		}
		catch(error) {
			this.dispatchEvent(new CustomEvent("error", {'detail':error}));
			throw error;
		}
		callback(data);
	}

	function onError(error) {
		this.dispatchEvent(new CustomEvent("error", {'detail':error}));
		throw error;
	}
}

Client.prototype.signin = function(name, password, callback) {
	var namepw = this.crypto.concatenateStrings(name, password);
	var alias = this.crypto.generateSecureHash(name, password);
	var aliasUrl = alias.replace('+','-').replace('/','_').replace('=','');
	this.sendJson("GET", "/!/account/"+aliasUrl, undefined, afterGetAccount.bind(this));

	function afterGetAccount(data) {
		var seed = this.crypto.generateSecureHash(namepw, data['salt']);
		var authL = this.crypto.generateKeypair(seed);
		var auth = this.crypto.combineKeypair(authL.privateKey, data['auth_n']);
		Credentials[this.id].account = {
			'id': data['id'],
			'alias': data['alias'],
			'auth': auth
		};
		callback({'id':data['id']});
	}
}

Client.prototype.createAccount = function(name, password, values, callback) {
	var namepw = this.crypto.concatenateStrings(name, password);
	var data = Object.create(values);
	data['alias'] = this.crypto.generateSecureHash(name, password);
	data['salt'] = this.crypto.generateKey();
	data['ksalt'] = this.crypto.generateKey();
	data['ssalt'] = this.crypto.generateKey();
	var seed = this.crypto.generateSecureHash(namepw, data['salt']);
	var authL = this.crypto.generateKeypair(seed);
	data['auth_l'] = authL.publicKey;
	this.sendJson("POST", "/!/account", data, afterPostAccount.bind(this));

	function afterPostAccount(data) {
		var auth = this.crypto.combineKeypair(authL.privateKey, data['auth_n']);
		Credentials[this.id].account = {
			'id': data['id'],
			'alias': data['alias'],
			'auth': auth
		};
		callback({'id':data['id']});
	}
}

Client.prototype.readAccount = function(id, callback) {
	this.sendJson("GET", "/!/account/"+id, undefined, afterGetAccount.bind(this));

	function afterGetAccount(data) {
		callback(data);
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
