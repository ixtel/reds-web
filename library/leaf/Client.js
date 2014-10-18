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
	Vault[id] = new Object();
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

Client.prototype.$createRequest = function(method, path, onload, onerror) {
	var request = new Request(this.crypto);
	request.addEventListener("send", onSend.bind(this));
	onload && request.addEventListener("load", onload);
	onerror && request.addEventListener("error", onerror);
	request.addEventListener("load", onLoad.bind(this));
	request.addEventListener("error", onError.bind(this));
	request.open(method, this.options.url, path);
	return request;

	function onSend(evt) {
		this.dispatchEvent(new Event("send"));
	}

	function onLoad(evt) {
		this.dispatchEvent(new Event("load"));
	}

	function onError(evt) {
		var error = evt.detail||new Error("connection error");
		this.dispatchEvent(new CustomEvent("error", {'detail':error}));
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
		Vault[this.vid] = vault;
		Vault[this.vid].account['asec'] = asec;
		console.log(Vault[this.vid]);
		callback({'id':Vault[this.vid].account['id']});
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
	request.writeJson({
		'alias': alias,
		'asalt': asalt,
		'auth_l': authL.publicKey
	});
	request.send();

	function onLoad() {
		var auth = this.crypto.combineKeypair(authL.privateKey, request.responseJson['auth_n']);
		var asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), asalt);
		Vault[this.vid] = {
			'account': {
				'id': request.responseJson['id'],
				'alias': alias,
				'auth': auth,
				'asec' : asec
			},
			'domain': {}
		};
		this.updateVault(afterUpdateVault.bind(this));
	}
	
	function afterUpdateVault() {
		callback({'id':Vault[this.vid].account['id']});
	}
}

Client.prototype.deleteAccount = function(callback) {
	var request = this.$createRequest("DELETE", "/!/account/"+Vault[this.vid].account['id'], onLoad.bind(this));
	request.sign(Vault[this.vid].account);
	request.send();

	function onLoad() {
		Vault.resetClient(this.id);
		callback();
	}
}

// INFO Vault operations
// NOTE These will usually be called only from within the client.

Client.prototype.updateVault = function(callback) {
	var vec = this.crypto.generateTimestamp();
	// NOTE This JSON dance is neccasary to create a real clone.
	var vault = JSON.parse(JSON.stringify(Vault[this.vid]));
	delete vault.account['asec'];
	vault = this.crypto.encryptData(JSON.stringify(vault), Vault[this.vid].account['asec'], vec);
	var request = this.$createRequest("PUT", "/!/account/"+Vault[this.vid].account['id'], onLoad.bind(this));
	request.writeJson({
		'vault': vault,
		'vec': vec
	});
	request.sign(Vault[this.vid].account);
	request.send();
	
	function onLoad() {
		console.log(Vault[this.vid]);
		callback();
	}
}

// INFO Domain operations
// NOTE These will usually be called only from within the client.

Client.prototype.createDomain = function(pod, password, callback) {
	var dkeyL = this.crypto.generateKeypair();
	var request = this.$createRequest("POST", "/!/domain", onLoad.bind(this));
	request.writeJson({
		'pod': pod,
		'dkey_l': dkeyL.publicKey
	});
	request.send();

	function onLoad(result) {
		var pkey, domain;
		pkey = this.crypto.generateSecureHash(password, request.responseJson['psalt']);
		domain = {
			'did': request.responseJson['did'],
			'dkey': this.crypto.combineKeypair(dkeyL.privateKey, request.responseJson['dkey_p'], pkey),
		};
		Vault[this.vid].domain[domain['did']] = domain;
		callback({'did':domain['did']});
	}
}

Client.prototype.createOwnerTicket = function(did, callback) {
	var tkeyL, request, domain;
	tkeyL = this.crypto.generateKeypair();
	request = this.$createRequest("POST", "/!/domain/"+did+"/ticket", onLoad.bind(this));
	request.writeDomain({
		'tkey_l': tkeyL.publicKey
	}, Vault[this.vid].domain[did]);
	request.send();

	function onLoad(result) {
		domain = Vault[this.vid].domain[did];
		domain['tid'] = request.responseDomain['tid'],
		domain['tflags'] = request.responseDomain['tflags'],
		domain['tkey'] = this.crypto.combineKeypair(tkeyL.privateKey, request.responseDomain['tkey_p'])
		callback({'tid':domain['tid'],'did':domain['did']});
	}
}

Client.prototype.resolveDomain = function(path, callback) {
	var match, request, dids;
	match = path.match(/(^(?:\/([^\/]+)\/(\d+))+)?(?:\/[^\/]+\/\*)?$/);
	if (match[1]) {
		// NOTE This will fail for now
		// TODO Implement some kind of caching to reduce HEAD requests
		request = this.$createRequest("HEAD", match[1], onLoad.bind(this));
		request.send();
	}
	else {
		dids = Object.keys(Vault[this.vid].domain); 
		callback(dids);
	}

	function onLoad() {
		var dids;
		dids = request.responseType.options['did'].split(",");
		callback(dids);
	}
} 

// INFO Entity operations

Client.prototype.createEntity = function(path, data, domain, callback) {
	var request, did;
	if (typeof domain == "object")
		this.createDomain(domain['url'], domain['password'], afterCreateDomain.bind(this));
	else
		afterUpdateVault.call(this);

	function afterCreateDomain(result) {
		this.createOwnerTicket(result['did'], afterCreateOwnerTicket.bind(this));
	}

	function afterCreateOwnerTicket(result) {
		did = result['did'];
		this.updateVault(afterUpdateVault.bind(this));
	}

	function afterUpdateVault() {
		request = this.$createRequest("POST", path, onLoad.bind(this));
		request.writeDomain(data, Vault[this.vid].domain[did]);
		request.send();
	}

	function onLoad() {
		callback(request.responseDomain);
	}
}

Client.prototype.readEntities = function(path, callback) {
	var eids, count, results, did, request;
	this.resolveDomain(path, afterResolveDomain.bind(this));

	function afterResolveDomain(dids) {
		results = new Array();
		for (count=0; count < dids.length; count++)
			readEntitiesForDomain.call(this, dids[count], afterReadEntity.bind(this));
	}

	function readEntitiesForDomain(did, callback) {
		var request;
		request = this.$createRequest("GET", path, onLoad.bind(this), onError.bind(this));
		request.writeDomain(undefined, Vault[this.vid].domain[did]);
		request.send();

		function onLoad() {
			if (request.responseJson)
				results = results.concat(request.responseJson);
			if (--count == 0)
				callback();
		}

		function onError(evt) {
			evt.stopImmediatePropagation();
			if (--count == 0)
				callback();
		}
	}

	function afterReadEntity() {
		callback(results);
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
