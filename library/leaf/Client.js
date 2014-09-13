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
	xhr.open(method, this.options.url+path, true);
	xhr.setRequestHeader("Content-Type", "application/json;charset=encoding");
	xhr.send(data ? JSON.stringify(data) : undefined);

	function onLoad() {
		callback(this.decodeResponse(xhr));
	}
}

Client.prototype.signup = function(name, password, callback) {
	var alias = this.crypto.generateSecureHash(name, password);
	var salt = this.crypto.generateKey();
	var ksalt = this.crypto.generateKey();
	var ssalt = this.crypto.generateKey();
	var namepw = this.crypto.concatenateStrings(name, password);
	var seed = this.crypto.generateSecureHash(namepw, salt);
	var authKeypair = this.crypto.generateKeypair(seed);
	this.sendJSON("POST", "/!/user/"+alias, {
		'alias': alias,
		'salt': salt,
		'ksalt': ksalt,
		'ssalt': ssalt,
		'auth': authKeypair.publicKey
	}, afterSend.bind(this));

	function afterSend(data) {
		Credentials[this.id].alias = alias;
		console.log(Credentials);
		callback && callback(data);
	}
}

Client.prototype.signin = function(name, password, callback) {
	var alias = this.crypto.generateSecureHash(name, password);
	var salt = this.crypto.generateKey();
	var ksalt = this.crypto.generateKey();
	var ssalt = this.crypto.generateKey();
	var namepw = this.crypto.concatenateStrings(name, password);
	var seed = this.crypto.generateSecureHash(namepw, salt);
	var authKeypair = this.crypto.generateKeypair(seed);
	this.sendJSON("GET", "/!/user/"+alias, null, afterSend.bind(this));

	function afterSend(data) {
		Credentials[this.id].alias = alias;
		console.log(Credentials);
		callback && callback(data);
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
