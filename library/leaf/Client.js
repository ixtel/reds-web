(function(){
"use strict";

var FacilityManager = window.reds ? reds.FacilityManager : require("../shared/FacilityManager");

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

Client.prototype.decodeResponse = function(xhr) {
	var contentType = xhr.getResponseHeader("Content-Type");
	console.log(contentType);
	return JSON.parse(xhr.responseText);
}

Client.prototype.sendJSON = function(method, path, data, callback) {
	var xhr = new XMLHttpRequest();
	xhr.addEventListener("load", onLoad.bind(this), false);
	xhr.addEventListener("error", onError.bind(this), false);
	xhr.open(method, this.options.url+path, true);
	xhr.setRequestHeader("Content-Type", "application/json;charset=encoding");
	if (this.dispatchEvent(new CustomEvent("send", {'detail':data,'cancelable':true})))
		xhr.send(data ? JSON.stringify(data) : undefined);

	function onLoad() {
		if (xhr.status >= 400)
			// TODO Replace Error with some kind of HttpError object
			return onError.bind(this)(new Error(xhr.status+" "+xhr.statusText));

		this.dispatchEvent(new Event("load"));
		callback(this.decodeResponse(xhr));
	}

	function onError(error) {
		if (this.dispatchEvent(new CustomEvent("error", {'detail':error,'cancelable':true})))
			throw error;
	}
}

Client.prototype.signin = function(name, password, callback) {
	var data = new Object();
	var alias = this.crypto.generateSecureHash(name, password);
	var salt = this.crypto.generateKey();
	var ksalt = this.crypto.generateKey();
	var ssalt = this.crypto.generateKey();
	var namepw = this.crypto.concatenateStrings(name, password);
	var seed = this.crypto.generateSecureHash(namepw, salt);
	var authKeypair = this.crypto.generateKeypair(seed);
	this.sendJSON("GET", "/!/account/"+alias, null, afterGetAccount.bind(this));

	function afterGetAccount(data) {
		Credentials[this.id].alias = alias;
		callback(data);
	}
}

Client.prototype.createAccount = function(name, password, values, callback) {
	var data = Object.create(values);
	data['alias'] = this.crypto.generateSecureHash(name, password);
	data['salt'] = this.crypto.generateKey();
	data['ksalt'] = this.crypto.generateKey();
	data['ssalt'] = this.crypto.generateKey();
	var namepw = this.crypto.concatenateStrings(name, password);
	var seed = this.crypto.generateSecureHash(namepw, data['salt']);
	var authL = this.crypto.generateKeypair(seed);
	data['auth_l'] = authL.publicKey;
	this.sendJSON("POST", "/!/account", data, afterPostAccount.bind(this));

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
	this.sendJSON("GET", "/!/account/"+id, undefined, afterGetAccount.bind(this));

	function afterGetAccount(data) {
		callback(data);
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
