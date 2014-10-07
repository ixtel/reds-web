(function(){
"use strict";

var FacilityManager = window.reds ? reds.FacilityManager : require("../shared/FacilityManager");
var Request = window.reds ? reds.leaf.Request : require("./Request");

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

// INFO Facility managers

var CryptoFacilities = new FacilityManager();
CryptoFacilities.addFacility(window.reds ? reds.crypto.CryptoJs : require("../shared/crypto/CryptoJs"));
CryptoFacilities.addFacility(window.reds ? reds.crypto.Sjcl : require("../shared/crypto/Sjcl"));

// INFO Client

var Client = function(options) {
	this.cid = Credentials.registerClient();
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
	var aliasUrl = alias.replace('+','-').replace('/','_').replace('=','');
	var request = this.$createRequest("GET", "/!/account/"+aliasUrl, onLoad.bind(this));
	request.send();

	function onLoad() {
		var asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), request.responseJson['asalt']);
		var blob = JSON.parse(this.crypto.decryptData(request.responseJson['blob'], asec, request.responseJson['vec']));
		Credentials[this.cid].account = {
			'id': request.responseJson['id'],
			'alias': alias,
			'auth': blob.auth,
			'akey': blob.akey
		};
		callback({'id':Credentials[this.cid].account['id']});
	}
}

Client.prototype.signout = function(callback) {
	Credentials[this.cid] = new Object();
	// NOTE Alawys call the callback asynchoniously
	setTimeout(callback, 0);
}

// INFO Account operations

Client.prototype.createAccount = function(name, password, pod, podword, callback) {
	var account = null;
	var alias = this.crypto.generateSecureHash(name, password);
	var asalt = this.crypto.generateKey();
	var authL = this.crypto.generateKeypair();
	var akeyL = this.crypto.generateKeypair();
	var request = this.$createRequest("POST", "/!/account", onPostLoad.bind(this));
	request.sendJson({
		'alias': alias,
		'asalt': asalt,
		'auth_l': authL.publicKey,
		'akey_l': akeyL.publicKey,
		'pod': pod
	});

	function onPostLoad() {
		var pkey = this.crypto.generateSecureHash(podword, request.responseJson['psalt']);
		account = {
			'id': request.responseJson['id'],
			'alias': alias,
			'auth': this.crypto.combineKeypair(authL.privateKey, request.responseJson['auth_n']),
			'akey': this.crypto.combineKeypair(akeyL.privateKey, request.responseJson['akey_p'], pkey),
		};
		request = this.$createRequest("PUT", "/!/account/"+account['id'], onPutLoad.bind(this));
		var asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), asalt);
		var vec = this.crypto.generateTimestamp();
		var blob = this.crypto.encryptData(JSON.stringify({
			'auth': account['auth'],
			'akey': account['akey']
		}), asec, vec);
		request.sign(account);
		request.sendJson({
			'blob': blob,
			'vec': vec
		});
	}
	
	function onPutLoad() {
		Credentials[this.cid].account = account;
		callback({'id':Credentials[this.cid].account['id']});
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
