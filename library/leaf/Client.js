(function(){
"use strict";

var FacilityManager = window.reds ? reds.FacilityManager : require("../shared/FacilityManager");
var Request = window.reds ? reds.leaf.Request : require("./Request");

// INFO Credential database

var Vault = new Object();

Vault.registerClient = function() {
	var id = Math.floor(Math.random()*0xffffffff);
	while (Vault[id])
		id = Math.floor(Math.random()*0xffffffff);
	this.resetClient(id);
	return id;
}

Vault.unregisterClient = function(id) {
	delete Vault[id];
}

Vault.resetClient = function(id) {
	Vault[id] = {
		'keys': null,
		'root': null,
	};
}

// INFO Facility managers

var CryptoFacilities = new FacilityManager();
CryptoFacilities.addFacility(window.reds ? reds.crypto.CryptoJs : require("../shared/crypto/CryptoJs"));
CryptoFacilities.addFacility(window.reds ? reds.crypto.Sjcl : require("../shared/crypto/Sjcl"));

// INFO Client

var Client = function(options) {
	this.vid = Vault.registerClient();
	// TODO Find a way to handle multiple crypto facilities
	this.crypto = this.createCryptoFacility(options.crypto[0]);
	this.options = options;
	// NOTE Hack to add DOM event handling to non-DOM object
	var eventTarget = document.createTextNode(null);
	this.addEventListener = eventTarget.addEventListener.bind(eventTarget);
	this.removeEventListener = eventTarget.removeEventListener.bind(eventTarget);
	this.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);
}

CryptoFacilities.addFactoryToObject("createCryptoFacility", Client.prototype);

Client.prototype.$createRequest = function(method, path, callback) {
	var request = new Request(this.crypto);
	request.addEventListener("send", onSend.bind(this));
	request.addEventListener("load", onLoad.bind(this));
	request.addEventListener("error", onError.bind(this));
	request.open(method, this.options.url, path);
	return request;

	function onSend(evt) {
		this.dispatchEvent(new Event("send"));
	}

	function onLoad(evt) {
		this.dispatchEvent(new Event("load"));
		callback(evt);
	}

	function onError(evt) {
		this.dispatchEvent(new CustomEvent("error", {'detail':evt.detail}));
	}
}

Client.prototype.signin = function(name, password, callback) {
	var alias = this.crypto.generateSecureHash(name, password);
	var aliasUrl = alias.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
	var request = this.$createRequest("GET", "/!/account/"+aliasUrl, onLoad.bind(this));
	request.send();

	function onLoad() {
		var asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), request.responseJson['asalt']);
		var vault = JSON.parse(this.crypto.decryptData(request.responseJson['vault'], asec, request.responseJson['vec']));
		Vault[this.vid].keys = vault.keys;
		Vault[this.vid].root = vault.root;
		Vault[this.vid].keys.account['asec'] = asec;
		callback({'id':Vault[this.vid].keys.account['id']});
	}
}

Client.prototype.signout = function(callback) {
	Vault.resetClient(this.id);
	// NOTE Always call the callback asynchoniously
	setTimeout(callback, 0);
}

// INFO Account operations

Client.prototype.createAccount = function(name, password, callback) {
	var account = null;
	var alias = this.crypto.generateSecureHash(name, password);
	var asalt = this.crypto.generateKey();
	var authL = this.crypto.generateKeypair();
	var request = this.$createRequest("POST", "/!/account", onLoad.bind(this));
	request.sendJson({
		'alias': alias,
		'asalt': asalt,
		'auth_l': authL.publicKey
	});

	function onLoad() {
		var auth = this.crypto.combineKeypair(authL.privateKey, request.responseJson['auth_n']);
		var asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), asalt);
		Vault[this.vid].keys = {
			'account': {
				'id': request.responseJson['id'],
				'alias': alias,
				'auth': auth,
				'asec' : asec
			},
			'domains': null
		};
		this.updateVault(afterUpdateVault.bind(this));
	}
	
	function afterUpdateVault() {
		callback({'id':Vault[this.vid].keys.account['id']});
	}
}

Client.prototype.deleteAccount = function(callback) {
	var request = this.$createRequest("DELETE", "/!/account/"+Vault[this.vid].keys.account['id'], onLoad.bind(this));
	request.sign(Vault[this.vid].keys.account);
	request.send();

	function onLoad() {
		Vault.resetClient(this.id);
		callback();
	}
}

// INFO Vault operations

Client.prototype.updateVault = function(callback) {
	var vec = this.crypto.generateTimestamp();
	// NOTE This JSON dance is neccasary to create a real clone.
	var vault = JSON.parse(JSON.stringify(Vault[this.vid]));
	vault.keys.account['asec'] = undefined;
	vault = this.crypto.encryptData(JSON.stringify(vault), Vault[this.vid].keys.account['asec'], vec);
	var request = this.$createRequest("PUT", "/!/account/"+Vault[this.vid].keys.account['id'], onLoad.bind(this));
	request.sign(Vault[this.vid].keys.account);
	request.sendJson({
		'vault': vault,
		'vec': vec
	});
	
	function onLoad() {
		callback();
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
