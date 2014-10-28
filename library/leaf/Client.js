(function(){
"use strict";

var FacilityManager = window.reds ? reds.FacilityManager : require("../shared/FacilityManager");
var Request = window.reds ? reds.leaf.Request : require("./Request");

// INFO Credential database

var Vault = new Object();

Vault.registerClient = function() {
	var vid = Math.floor(Math.random()*0xffffffff);
	while (Vault[vid])
		vid = Math.floor(Math.random()*0xffffffff);
	this.resetClient(vid);
	return vid;
}

Vault.unregisterClient = function(vid) {
	delete Vault[vid];
}

Vault.resetClient = function(vid) {
	Vault[vid] = new Object();
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
		callback({'aid':Vault[this.vid].account['id']});
	}
}

Client.prototype.signout = function(callback) {
	Vault.resetClient(this.vid);
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
				'id': request.responseJson['aid'],
				'alias': alias,
				'auth': auth,
				'asec' : asec
			},
			'domain': {}
		};
		this.updateVault(afterUpdateVault.bind(this));
	}
	
	function afterUpdateVault() {
		callback({'aid':Vault[this.vid].account['id']});
	}
}

Client.prototype.deleteAccount = function(callback) {
	var request = this.$createRequest("DELETE", "/!/account/"+Vault[this.vid].account['id'], onLoad.bind(this));
	request.sign(Vault[this.vid].account);
	request.send();

	function onLoad() {
		Vault.resetClient(this.vid);
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
			'id': request.responseJson['did'],
			'dkey': this.crypto.combineKeypair(dkeyL.privateKey, request.responseJson['dkey_p'], pkey),
		};
		Vault[this.vid].domain[domain['id']] = domain;
		callback({'did':domain['id']});
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
		callback({'tid':domain['tid'],'did':domain['id']});
	}
}

Client.prototype.deleteDomains = function(dids, callback) {
	var results, errors, count;
	results = new Array();
	errors = new Array();
	for (count=0; count < dids.length; count++)
		deleteDomain.call(this, dids[count], afterDeleteDomain.bind(this));

	function deleteDomain(did, callback) {
		var request;
		request = this.$createRequest("DELETE", "/!/domain/"+did, onLoad.bind(this), onError.bind(this));
		request.writeDomain(undefined, Vault[this.vid].domain[did]);
		request.send();

		function onLoad() {
			results = results.concat(request.responseJson);
			delete Vault[this.vid].domain[request.responseJson['did']];
			if (--count == 0)
				callback();
		}

		function onError(evt) {
			evt.stopImmediatePropagation();
			errors.push(evt.detail);
			if (--count == 0)
				callback();
		}
	}

	function afterDeleteDomain() {
		if (errors.length)
			return this.dispatchEvent(new CustomEvent("error", {'detail':errors}));
		callback(results);
	}
}

// INFO Entity operations

// NOTE Finds the did of the last eid in path.
// TODO Use * instead of empty values
Client.prototype.resolvePath = function(path, callback) {
	var match, request, dids;
	match = path.match(/(^(?:\/([^\/]+)\/(\d+))+)?(?:\/[^\/]+\/)?$/);
	if (match[1]) {
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

Client.prototype.createEntity = function(path, data, callback) {
	var request;
	if (data['did'])
		afterResolvePath.call(this, [data['did']]);
	else
		this.resolvePath(path, afterResolvePath.bind(this));

	function afterResolvePath(dids) {
		request = this.$createRequest("POST", path, onLoad.bind(this));
		request.writeDomain(data, Vault[this.vid].domain[dids[0]]);
		request.send();
	}

	function onLoad() {
		callback(request.responseDomain);
	}
}

Client.prototype.readEntities = function(path, callback) {
	var results, errors, count;
	this.resolvePath(path, afterResolvePath.bind(this));

	function afterResolvePath(dids) {
		results = new Array();
		errors = new Array();
		for (count=0; count < dids.length; count++)
			readEntitiesForDomain.call(this, dids[count], afterReadEntitiesForDomain.bind(this));
	}

	function readEntitiesForDomain(did, callback) {
		var request, type;
		request = this.$createRequest("GET", path, onLoad.bind(this), onError.bind(this));
		request.writeDomain(undefined, Vault[this.vid].domain[did]);
		request.send();

		function onLoad() {
			for (type in request.responseDomain) {
				if (results[type])
					results[type] = results[type].concat(request.responseDomain[type]);
				else
					results[type] = request.responseDomain[type];
			}
			if (--count == 0)
				callback();
		}

		function onError(evt) {
			evt.stopImmediatePropagation();
			errors.push(evt.detail);
			if (--count == 0)
				callback();
		}
	}

	// TODO Read entities from other domains
	function afterReadEntitiesForDomain() {
		var type;
		if (errors.length > 0)
			this.dispatchEvent(new CustomEvent("error", {'detail':errors}));
		else for (type in results)
			callback(results[type], type);
	}
}

Client.prototype.updateEntities = function(path, data, callback) {
	var results, errors, count, type;
	if (Array.isArray(data)) {
		// NOTE We use results as a temporary buffer here - dirty but it works ;)
		results = data;
		type = path.match(/([^\/]+)\/[^\/]*$/)[1];
		data = new Object();
		data[type] = results;
	}
	this.resolvePath(path, afterResolvePath.bind(this));

	function afterResolvePath(dids) {
		results = new Array();
		errors = new Array();
		for (count=0; count < dids.length; count++)
			updateEntitiesForDomain.call(this, dids[count], afterUpdateEntitiesForDomain.bind(this));
	}

	function updateEntitiesForDomain(did, callback) {
		var request, type;
		request = this.$createRequest("PUT", path, onLoad.bind(this), onError.bind(this));
		request.writeDomain(data, Vault[this.vid].domain[did]);
		request.send();

		function onLoad() {
			for (type in request.responseDomain) {
				if (results[type])
					results[type] = results[type].concat(request.responseDomain[type]);
				else
					results[type] = request.responseDomain[type];
			}
			if (--count == 0)
				callback();
		}

		function onError(evt) {
			evt.stopImmediatePropagation();
			errors.push(evt.detail);
			if (--count == 0)
				callback();
		}
	}

	// TODO Update entities from other domains
	function afterUpdateEntitiesForDomain() {
		var type;
		if (errors.length > 0)
			this.dispatchEvent(new CustomEvent("error", {'detail':errors}));
		else for (type in results)
			callback(results[type], type);
	}
}

// TODO Split into deleteEntities and deleteEntitiesAndDomains
Client.prototype.deleteEntities = function(path, callback) {
	var results, errors, count;
	this.resolvePath(path, afterResolvePath.bind(this));

	function afterResolvePath(dids) {
		results = new Array();
		errors = new Array();
		for (count=0; count < dids.length; count++)
			deleteEntitiesForDomain.call(this, dids[count], afterDeleteEntitiesForDomain.bind(this));
	}

	function deleteEntitiesForDomain(did, callback) {
		var request, type;
		request = this.$createRequest("DELETE", path, onLoad.bind(this), onError.bind(this));
		request.writeDomain(undefined, Vault[this.vid].domain[did]);
		request.send();

		function onLoad() {
			results = results.concat(request.responseDomain);
			if (--count == 0)
				callback();
		}

		function onError(evt) {
			evt.stopImmediatePropagation();
			errors.push(evt.detail);
			if (--count == 0)
				callback();
		}
	}

	// TODO Delete entities from other domains
	function afterDeleteEntitiesForDomain() {
		var dids, domains, i;
		if (errors.length > 0)
			return this.dispatchEvent(new CustomEvent("error", {'detail':errors}));
		dids = new Array();
		for (i=0; i<results.length; i++)
			if (results[i]['ecount'] == 0)
				dids.push(results[i]['did']);
		if (dids.length)
			this.deleteDomains(dids, afterDeleteDomains.bind(this));
		else
			callback();	
	}

	function afterDeleteDomains(result) {
		this.updateVault(function() {
			callback(result);
		});
	}
}

// INFO Conveniance functions

Client.prototype.createDomainWithEntity = function(url, password, path, data, callback) {
	var results;
	results = {
		'domain': null,
		'entity': null
	}
	this.createDomain(url, password, afterCreateDomain.bind(this));

	function afterCreateDomain(result) {
		results.domain = result;
		this.createOwnerTicket(result['did'], afterCreateOwnerTicket.bind(this));
	}

	function afterCreateOwnerTicket(result) {
		this.updateVault(afterUpdateVault.bind(this));
	}

	function afterUpdateVault() {
		data['did'] = results.domain['did'];
		this.createEntity(path, data, afterCreateEntity);
	}

	function afterCreateEntity(result) {
		results.entity = result;
		callback(results);
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
