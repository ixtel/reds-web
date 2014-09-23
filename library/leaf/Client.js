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
	console.log(this.cid);
	// TODO Find a way to handle crypto facilities individually for each node and pod
	this.crypto = this.createCryptoFacility(options.crypto[0]);
	this.options = options;
	// NOTE Hack to add DOM event handling to non-DOM object
	var eventTarget = document.createTextNode(null);
	this.addEventListener = eventTarget.addEventListener.bind(eventTarget);
	this.removeEventListener = eventTarget.removeEventListener.bind(eventTarget);
	this.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);
}

CryptoFacilities.addFinalFactoryToObject("createCryptoFacility", Client.prototype);

Client.prototype.$createRequest = function(method, path, callback) {
	var request = new Request(this.crypto, Credentials[this.cid]);
	request.addEventListener("send", onSend.bind(this));
	request.addEventListener("load", onLoad.bind(this));
	request.addEventListener("error", onError.bind(this));
	request.open(method, this.options.url+path);
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
	var namepw = this.crypto.concatenateStrings(name, password);
	var alias = this.crypto.generateSecureHash(name, password);
	var aliasUrl = alias.replace('+','-').replace('/','_').replace('=','');
	var request = this.$createRequest("GET", "/!/account/"+aliasUrl, onLoad.bind(this));
	request.send();

	function onLoad() {
		var data = request.responseJson;
		var seed = this.crypto.generateSecureHash(namepw, data['salt']);
		var authL = this.crypto.generateKeypair(seed);
		var auth = this.crypto.combineKeypair(authL.privateKey, data['auth_n']);
		Credentials[this.cid].account = {
			'id': data['id'],
			'alias': data['alias'],
			'auth': auth
		};
		callback({'id':data['id']});
	}
}

Client.prototype.signout = function(callback) {
	Credentials[id] = new Object();
	// NOTE Call the callback asynchoniously
	setTimeout(callback, 0);
}

// INFO Account operations

Client.prototype.createAccount = function(name, password, pod, podword, callback) {
	var namepw = this.crypto.concatenateStrings(name, password);
	var data = new Object();
	data['alias'] = this.crypto.generateSecureHash(name, password);
	data['salt'] = this.crypto.generateKey();
	data['ksalt'] = this.crypto.generateKey();
	data['ssalt'] = this.crypto.generateKey();
	var seed = this.crypto.generateSecureHash(namepw, data['salt']);
	var kseed = this.crypto.generateSecureHash(namepw, data['salt']);
	var authL = this.crypto.generateKeypair(seed);
	var akeyL = this.crypto.generateKeypair(kseed);
	data['auth_l'] = authL.publicKey;
	data['akey_l'] = akeyL.publicKey;
	data['pod'] = pod;
	var request = this.$createRequest("POST", "/!/account", onLoad.bind(this));
	request.sendJson(data);

	function onLoad() {
		console.log(request.responseJson);
		var auth = this.crypto.combineKeypair(authL.privateKey, request.responseJson['auth_n']);
		var akey = this.crypto.combineKeypair(akeyL.privateKey, request.responseJson['akey_p']);
		var sseed = this.crypto.generateSecureHash(namepw, data['ssalt']);
		var asec = this.crypto.generateKey(sseed);
		Credentials[this.cid].account = {
			'id': request.responseJson['id'],
			'alias': request.responseJson['alias'],
			'auth': auth,
			'akey': akey,
			'asec': asec
		};
		callback({'id':request.responseJson['id']});
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
