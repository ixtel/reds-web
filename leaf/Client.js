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

Client.prototype.$emitEvent = function(name, callback, detail) {
	var retval;
	if (callback) {
		retval = callback(detail);
		detail = retval!==undefined?retval:detail;
	}
	if (detail !== false)
		this.dispatchEvent(new CustomEvent(name, {'detail':detail}));
	return detail;
}

Client.prototype.$createRequest = function(credentials, callback, errorCallback, onLoad, onError) {
	var request = new Request(this.crypto, credentials);
	request.addEventListener("send", onSend.bind(this));
	request.addEventListener("load", onLoad||onLoadDefault.bind(this));
	request.addEventListener("error", onError||onErrorDefault.bind(this));
	return request;

	function onSend(evt) {
		this.dispatchEvent(new Event("send"));
	}

	function onLoadDefault(evt) {
		this.$emitEvent("load", callback, null);
	}

	function onErrorDefault(evt) {
		this.$emitEvent("error", errorCallback, evt.detail);
	}
}

Client.prototype.signin = function(name, password, callback, errorCallback) {
	var alias = this.crypto.generateSecureHash(name, password);
	var aliasUrl = alias.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
	var request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
	request.open("GET", this.options.url, "/!/account/"+aliasUrl);
	request.send();

	function onLoad() {
		var asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), request.responseJson['asalt']);
		var vault = JSON.parse(this.crypto.decryptData(request.responseJson['vault'], asec, request.responseJson['vec']));
		Vault[this.vid] = vault;
		Vault[this.vid].account['asec'] = asec;
		this.$emitEvent("load", callback, {'aid':Vault[this.vid].account['aid']});
	}
}

Client.prototype.signout = function(callback) {
	Vault.resetClient(this.vid);
	// NOTE Always call the callback asynchronously
	setTimeout(callback, 0);
}

// INFO Account operations

Client.prototype.createAccount = function(name, password, callback, errorCallback) {
	var account = null;
	var alias = this.crypto.generateSecureHash(name, password);
	var asalt = this.crypto.generateKey();
	var authL = this.crypto.generateKeypair();
	var request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
	request.open("POST", this.options.url, "/!/account");
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
				'aid': request.responseJson['aid'],
				'akey': auth,
				'asec' : asec
			},
			'domain': {}
		};
		// TODO Move into conveniance
		this.updateVault(afterUpdateVault.bind(this));
	
		function afterUpdateVault() {
			this.$emitEvent("load", callback, {'aid':Vault[this.vid].account['aid']});
		}
	}
}

Client.prototype.deleteAccount = function(callback, errorCallback) {
	var request = this.$createRequest(Vault[this.vid].account, callback, errorCallback, onLoad.bind(this));
	request.open("DELETE", this.options.url, "/!/account/"+Vault[this.vid].account['aid']);
	request.signAccount();
	request.send();

	function onLoad() {
		if (!request.authorizeAccount(Vault[this.vid].account))
			return;
		Vault.resetClient(this.vid);
		this.$emitEvent("load", callback);
	}
}

Client.prototype.updateVault = function(callback, errorCallback) {
	var vec = this.crypto.generateTimestamp();
	// NOTE This JSON dance is necessary to create a real clone.
	var vault = JSON.parse(JSON.stringify(Vault[this.vid]));
	delete vault.account['asec'];
	for (var did in vault.domain) {
		delete vault.domain[did]['lid'];
		delete vault.domain[did]['vec'];
	}
	vault = this.crypto.encryptData(JSON.stringify(vault), Vault[this.vid].account['asec'], vec);
	var request = this.$createRequest(Vault[this.vid].account, callback, errorCallback, onLoad.bind(this));
	request.open("PUT", this.options.url, "/!/account/"+Vault[this.vid].account['aid']);
	request.writeJson({
		'vault': vault,
		'vec': vec
	});
	request.signAccount();
	request.send();
	
	function onLoad() {
		if (!request.authorizeAccount())
			return;
		this.$emitEvent("load", callback);
	}
}

// INFO Pod operations

Client.prototype.createPod = function(url, password, callback, errorCallback) {
	var request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
	request.open("POST", this.options.url, "/!/pod");
	request.writeJson({
		'url': url
	});
	request.send();

	function onLoad() {
		this.$emitEvent("load", callback, request.responseJson);
	}
}

// INFO Domain operations

Client.prototype.createDomain = function(pod, password, callback, errorCallback) {
	var dkeyL = this.crypto.generateKeypair();
	var request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this), onerror);
	request.open("POST", this.options.url, "/!/domain");
	request.writeJson({
		'pod': pod,
		'dkey_l': dkeyL.publicKey
	});
	request.send();

	function onLoad() {
		var pkey, domain;
		pkey = this.crypto.generateSecureHash(password, request.responseJson['psalt']);
		domain = {
			'did': request.responseJson['did'],
			'dkey': this.crypto.combineKeypair(dkeyL.privateKey, request.responseJson['dkey_p'], pkey),
		};
		Vault[this.vid].domain[domain['did']] = domain;
		this.$emitEvent("load", callback, {'did':domain['did']});
	}
}

Client.prototype.deleteDomains = function(dids, callback, errorCallback) {
	var results, errors, count;
	if (dids.length == 0)
		return callback(null);
	results = new Array();
	errors = new Array();
	for (count=0; count < dids.length; count++)
		deleteDomain.call(this, dids[count], afterDeleteDomain.bind(this));

	function deleteDomain(did, callback) {
		var request;
		request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
		request.open("DELETE", this.options.url, "/!/domain/"+did);
		request.writeEncrypted(undefined);
		request.signDomain();
		request.send();

		function onLoad() {
			if (!request.authorizeDomain())
				return;
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
			this.$emitEvent("error", errorCallback, errors);
		else
			this.$emitEvent("load", callback, results);
	}
}

Client.prototype.createOwnerTicket = function(did, callback, errorCallback) {
	var tkeyL, request, domain;
	tkeyL = this.crypto.generateKeypair();
	request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this));
	request.open("POST", this.options.url, "/!/domain/"+did+"/ticket");
	request.writeJson({
		'tkey_l': tkeyL.publicKey
	});
	request.signDomain();
	request.send();

	function onLoad(result) {
		if (!request.authorizeDomain())
			return this.$emitEvent("error", errorCallback, new Error("domain anthorization failed"));
		var domain = Vault[this.vid].domain[did];
		domain['tid'] = request.responseJson['tid'],
		domain['tkey'] = this.crypto.combineKeypair(tkeyL.privateKey, request.responseJson['tkey_p']),
		domain['tflags'] = request.responseJson['tflags']
		this.$emitEvent("load", callback, {'did':did,'tid':domain['tid']});
	}
}

// INFO Entity operations

// NOTE This function uses the only callback and won't dispatch any events. 
Client.prototype.$refreshLeaf = function(did, callback) {
	var request, vecL;
	vecL = this.crypto.generateKeypair();
	request = this.$createRequest(Vault[this.vid].domain[did], undefined, undefined, onLoad.bind(this), onError.bind(this));
	request.open("POST", this.options.url, "/!/domain/"+did+"/leaf");
	request.writeJson({
		'vec_l': vecL.publicKey
	});
	request.signDomain();
	request.send();

	function onLoad(evt) {
		if (!request.authorizeDomain())
			return callback(new Error("domain authorization failed"), null);
		var domain = Vault[this.vid].domain[did];
		domain['vec'] = this.crypto.combineKeypair(vecL.privateKey, request.responseJson['vec_p']),
		domain['lid'] = this.crypto.generateHmac(domain['vec'], request.responseJson['lsalt']);
		callback(null, did);
	}

	function onError(evt) {
		callback(evt.detail, null);
	}
}

// NOTE This function uses the only callback and won't dispatch any events. 
Client.prototype.$registerLeaf = function(did, callback) {
	if (Vault[this.vid].domain[did]['vec'])
		callback(null, did);
	else
		this.$refreshLeaf(did, callback);
}

// NOTE This function uses the only callback and won't dispatch any events. 
// TODO Implement some kind of caching to reduce HEAD requests
Client.prototype.$resolvePath = function(path, callback) {
	var request;
	request = this.$createRequest(null, undefined, undefined, onLoad.bind(this), onError.bind(this));
	request.open("HEAD", this.options.url, path);
	request.send();

	// TODO Get rid of dids array
	function onLoad(evt) {
		var dids, i;
		dids = new Array();
		if (!request.responseType.options)
			return callback(null, null, 0, 0);
		request.responseType.options['did'].replace(/(?:^|,)(\d+)(?=,|$)/g, function(m, p) {
			var did;
			did = parseInt(p);
			if (Vault[this.vid].domain[did])
				dids.push(did);
			return false;
		}.bind(this));
		if (dids.length)
			dids.forEach(forEachDids.bind(this));
		else
			callback(null, null, 0, 0);

		function forEachDids(did, index, dids) {
			this.$registerLeaf(did, function(error, did) {
				callback(error, did, index, dids.length);
			}.bind(this));
		}
	}

	function onError(evt) {
		callback(evt.detail, null, 0, 0);
	}
}

Client.prototype.createEntity = function(path, data, callback, errorCallback) {
	var match, request;
	match = path.match(/^((?:\/\w+\/\d+)+)?\/\w+$/);
    console.log("createentity: " + path);
	if (!match)
		return this.$emitEvent("error", errorCallback, new Error("invalid path"));
	if (data['did'])
		this.$registerLeaf(data['did'], afterResolvePath.bind(this));
	else if (match[1])
		this.$resolvePath(match[1], afterResolvePath.bind(this));
	else
		return this.$emitEvent("error", errorCallback, new Error("unknown did"));

	function afterResolvePath(error, did, index, length) {
		if (error)
			return onError.call(this, {'detail':error});
		if (!did) {
    		if (length == 0)
				return finalize.call(this)
			else
				return onError.call(this, {'detail':new Error("undefined domain id")});
		}
		request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
		request.open("POST", this.options.url, path);
		request.writeEncrypted(data);
		request.signTicket();
		request.send();

		function onLoad() {
			if (!request.authorizeTicket())
				this.$emitEvent("error", errorCallback, new Error("anthorization failed"));
			else
				this.$emitEvent("load", callback, request.responseEncrypted);
		}

		function onError(evt) {
			if (evt.detail.code == 412) {
				return this.$refreshLeaf(did, function(error, did) {
					afterResolvePath.call(this, error, did, index, length);
				}.bind(this));
			}
			this.$emitEvent("error", errorCallback, evt.detail);
		}
	}
}

Client.prototype.readEntities = function(path, callback, errorCallback) {
	var match, results, errors, count;
	match = path.match(/^((?:\/\w+\/[\d,]+)*)?(?:\/\w+\/\*)?$/);
	if (!match)
		return this.$emitEvent("error", errorCallback, new Error("invalid path"));
	results = new Object();
	errors = new Array();
	count = 0;
	this.$resolvePath(match[0], afterResolvePath.bind(this));

	function afterResolvePath(error, did, index, length) {
		var request, type;
		if (error)
			return onError.call(this, {'detail':error});
		if (!did) {
    		if (length == 0)
				return finalize.call(this)
			else
				return onError.call(this, {'detail':new Error("undefined domain id")});
		}
		request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
		request.open("GET", this.options.url, path);
        request.writeEncrypted();
        request.signTicket(Vault[this.vid].domain[did]);
        request.send();

		function onLoad() {
            console.log("onLoad");
			if (!request.authorizeTicket())
				return this.$emitEvent("error", errorCallback, new Error("anthorization failed"));
			count++;
			for (type in request.responseEncrypted) {
				if (results[type])
					results[type] = results[type].concat(request.responseEncrypted[type]);
				else
					results[type] = request.responseEncrypted[type];
			}
			if (length-count == 0)
				finalize.call(this);
		}

		function onError(evt) {
			if (evt.detail.code == 412) {
				return this.$refreshLeaf(did, function(error, did) {
					afterResolvePath.call(this, error, did, index, length);
				}.bind(this));
			}
			count++;
			errors.push(evt.detail);
			if (length-count == 0)
				finalize.call(this);
		}
	}

	function finalize() {
		var type;
		if (errors.length)
			return this.$emitEvent("error", errorCallback, errors);
        for (type in results)
            this.$emitEvent("load", callback, results[type], type);
        if (!type)
            this.$emitEvent("load", callback, null, null);
	}
}

Client.prototype.updateEntities = function(path, data, callback, errorCallback) {
	var match, results, errors, count;
	match = path.match(/^(?:\/(\w+)\/[\d,]+)+$/);
	if (!match)
		return this.$emitEvent("error", errorCallback, new Error("invalid path"));
	// NOTE We use results as a temporary buffer here - dirty but it works ;)
	results = data;
	data = new Object();
	data[match[1]] = results;
	results = new Object();
	errors = new Array();
	count = 0;
	this.$resolvePath(match[0], afterResolvePath.bind(this));

	function afterResolvePath(error, did, index, length) {
		var request, type;
		if (error)
			return onError.call(this, {'detail':error});
		if (!did) {
    		if (length == 0)
				return finalize.call(this)
			else
				return onError.call(this, {'detail':new Error("undefined domain id")});
		}
		request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
		request.open("PUT", this.options.url, path);
		request.writeEncrypted(data);
		request.signTicket();
		request.send();

		function onLoad() {
			if (!request.authorizeTicket())
				return this.$emitEvent("error", errorCallback, new Error("anthorization failed"));
			count++;
			for (type in request.responseEncrypted) {
				if (results[type])
					results[type] = results[type].concat(request.responseEncrypted[type]);
				else
					results[type] = request.responseEncrypted[type];
			}
			if (length-count == 0)
				finalize.call(this);
		}

		function onError(evt) {
			evt.stopImmediatePropagation();
			if (evt.detail.code == 412) {
				return this.$refreshLeaf(did, function(error, did) {
					afterResolvePath.call(this, error, did, index, length);
				}.bind(this));
			}
			count++;
			errors.push(evt.detail);
			if (length-count == 0)
				finalize.call(this);
		}
	}

	function finalize() {
        var type;
        if (errors.length)
            return this.$emitEvent("error", errorCallback, errors);
        for (type in results)
            this.$emitEvent("load", callback, results[type], type);
        if (!type)
            this.$emitEvent("load", callback, null, null);
	}
}

Client.prototype.deleteEntities = function(path, callback, errorCallback) {
	var match, results, errors, count;
	match = path.match(/^((?:\/\w+\/[\d,]+)*)?(?:\/\w+\/\*)?$/);
	if (!match)
		return this.$emitEvent("error", errorCallback, new Error("invalid path"));
	results = new Object();
	errors = new Array();
	count = 0;
	this.$resolvePath(match[0], afterResolvePath.bind(this));

	function afterResolvePath(error, did, index, length) {
		var request, type;
		if (error)
			return onError.call(this, {'detail':error});
		if (!did) {
    		if (length == 0)
				return finalize.call(this)
			else
				return onError.call(this, {'detail':new Error("undefined domain id")});
		}
		request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
		request.open("DELETE", this.options.url, path);
		request.writeEncrypted(undefined);
		request.signTicket();
		request.send();

		function onLoad() {
			// TODO Support multiple MIME types
			//if (!request.authorizeTicket())
			//	return this.$emitEvent("error", errorCallback, new Error("anthorization failed"));
			count++;
			for (type in request.responseJson) {
				if (results[type])
					//results[type] = results[type].concat(request.responseEncrypted[type]);
					results[type] = results[type].concat(request.responseJson[type]);
				else
					//results[type] = request.responseEncrypted[type];
					results[type] = request.responseJson[type];
			}
			if (length-count == 0)
				finalize.call(this);
		}

		function onError(evt) {
			evt.stopImmediatePropagation();
			if (evt.detail.code == 412) {
				return this.$refreshLeaf(did, function(error, did) {
					afterResolvePath.call(this, error, did, index, length);
				}.bind(this));
			}
			count++;
			errors.push(evt.detail);
			if (length-count == 0)
				finalize.call(this);
		}
	}

	function finalize() {
        var type;
        if (errors.length)
            return this.$emitEvent("error", errorCallback, errors);
        for (type in results)
            this.$emitEvent("load", callback, results[type], type);
        if (!type)
            this.$emitEvent("load", callback, null, null);
	}
}

// INFO Convenience functions

Client.prototype.deleteEntitiesAndDomains = function(path, callback) {
	this.deleteEntities(path, afterDeleteEntities.bind(this));

	function afterDeleteEntities(result, type, last) {
		var dids, results, i;
		results = new Object();
		results.entities = result;
		dids = new Array();
		for (i=0; i<result.length; i++) {
			if (result[i]['root'])
				dids.push(result[i]['did']);
		}
		this.deleteDomains(dids, afterDeleteDomains.bind(this));

		function afterDeleteDomains(result) {
			results.domains = result;
			if (result)
				this.updateVault(afterUpdateVault);
			else
				callback(results, type, last);
		}

		function afterUpdateVault() {
			callback(results, type, last);
		}
	}
}

Client.prototype.createEntityAndDomain = function(path, data, url, password, callback) {
	var results;
	results = {
		'domain': null,
		'entity': null
	}
	this.createDomain(url, password, afterCreateDomain.bind(this), afterCreateDomainError.bind(this));

	function afterCreateDomain(result) {
		results.domain = result;
		this.createOwnerTicket(result['did'], afterCreateOwnerTicket.bind(this));
	}

	function afterCreateDomainError(error) {
		if (error.code == 502) {
			this.createPod(url, password, afterCreatePod.bind(this));
			return false;
		}

		function afterCreatePod(result) {
			this.createDomain(url, password, afterCreateDomain.bind(this));
		}
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
