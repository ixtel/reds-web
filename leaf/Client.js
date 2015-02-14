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

Client.prototype.$upgradeVault = function(vault) {
    var id;
    switch (vault.version?vault.version.join("."):null) {
        default:
            console.info("upgrading vault (0.2.2)")
            vault.version = [0,2,2];
            vault.exchange = vault.exchange||new Object();
            vault.invitation = vault.invitation||new Object();
            for (id in vault.domain)
                vault.domain[id]['modified'] = vault.domain[id]['timestamp']||Date.now(); 
            for (id in vault.exchange)
                vault.exchange[id]['modified'] = vault.exchange[id]['timestamp']||Date.now(); 
            for (id in vault.invitation)
                vault.invitation[id]['modified'] = vault.invitation[id]['timestamp']||Date.now(); 
        case "0.2.2":
            console.info("upgrading vault (0.2.3)");
            vault.version = [0,2,3];
            vault.tickets = vault.tickets||new Object();
            vault.invitations = vault.invitations||new Object();
            vault.exchanges = vault.exchanges||new Object();
            for (id in vault.domain) {
                vault.tickets[id] = [
                    vault.domain[id]['modified'],
                    vault.domain[id]['tid'],
                    vault.domain[id]['tkey'],
                    vault.domain[id]['tflags'],
                    vault.domain[id]['did']
                ];
            }
            for (id in vault.invitation) {
                vault.invitations[id] = [
                    vault.invitation[id]['modified'],
                    vault.invitation[id]['iid'],
                    vault.invitation[id]['ikey'],
                    vault.invitation[id]['xsig']
                ];
            }
            for (var id in vault.exchange) {
                vault.exchanges[id] = [
                    vault.exchange[id]['modified'],
                    id,
                    vault.exchange[id]['xkeyS'],
                    vault.exchange[id]['xsaltS'],
                    vault.exchange[id]['did'],
                    vault.exchange[id]['tflags']
                ];
            }
            delete vault.domain;
            delete vault.invitation;
            delete vault.exchange;
        case "0.2.3":
            // NOTE Nothing to be done for the latest version
    }
    return vault;
}

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
    var alias, aliasUrl, request;
    try {
        alias = this.crypto.generateSecureHash(name, password);
        aliasUrl = alias.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
        request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
        request.open("GET", this.options.url, "/!/account/"+aliasUrl);
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad() {
        var akey, asec;
        try {
            asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), request.responseJson['asalt']);
            Vault[this.vid] = JSON.parse(this.crypto.decryptData(request.responseJson['vault'], asec, request.responseJson['vec']));
            Vault[this.vid] = this.$upgradeVault(Vault[this.vid]);
            Vault[this.vid].modified = parseInt(request.responseJson['modified']); 
            Vault[this.vid].streams = new Object();
            Vault[this.vid].account.push(asec); // NOTE account[2] = account secret 
            console.log(Vault[this.vid]); // DEBUG
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, {'aid':Vault[this.vid].account[1]});
    }
}

Client.prototype.signout = function(callback) {
    Vault.resetClient(this.vid);
    // NOTE Always call the callback asynchronously
    setTimeout(callback, 0);
}

// INFO Account operations

Client.prototype.createAccount = function(name, password, callback, errorCallback) {
    var alias, asalt, akeyL, request;
    try {
        alias = this.crypto.generateSecureHash(name, password);
        asalt = this.crypto.generateKey();
        akeyL = this.crypto.generateKeypair();
        request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
        request.open("POST", this.options.url, "/!/account");
        request.write({
            'alias': alias,
            'asalt': asalt,
            'akey_l': akeyL.publicKey
        });
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad() {
        var akey, asec;
        try {
            akey = this.crypto.combineKeypair(akeyL.privateKey, request.responseJson['akey_n']);
            asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), asalt);
            Vault[this.vid] = {
                'account': [
                    Date.now(),                  // NOTE account[0] = modified timestamp
                    request.responseJson['aid'], // NOTE account[1] = account id
                    akey,                        // NOTE account[2] = account key
                    asec                         // NOTE account[3] = account secret
                ],
                'streams': {},
                'tickets': {},
                'invitations': {},
                'exchanges': {},
                'version': [0,2,3],
                'modified': request.responseJson['modified']
            };
        }
        catch(e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        // TODO Move updateVault call into conveniance function
        this.updateVault(afterUpdateVault.bind(this), errorCallback);
    
        function afterUpdateVault() {
            this.$emitEvent("load", callback, {'aid':Vault[this.vid].account[1]});
        }
    }
}

Client.prototype.deleteAccount = function(callback, errorCallback) {
    var request;
    try {
        request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
        request.open("DELETE", this.options.url, "/!/account/"+Vault[this.vid].account['aid']);
        request.sign("account", Vault[this.vid].account);
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad() {
        try {
            request.authorize("account", Vault[this.vid].account);
            Vault.resetClient(this.vid);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, null);
    }
}

Client.prototype.updateVault = function(callback, errorCallback) {
    console.log("updateVault");
    var retries, vec, vault, request;
    try {
        retries = 3;
        vec = this.crypto.generateTimestamp();
        // NOTE This JSON dance is necessary to create a real clone.
        vault = JSON.parse(JSON.stringify(Vault[this.vid]));
        vault.account.pop(); // NOTE Remove the account secret at account[3] 
        delete vault.streams;
        delete vault.modified;
        vault = this.crypto.encryptData(JSON.stringify(vault), Vault[this.vid].account[3], vec);
        request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this), onError.bind(this));
        request.open("PUT", this.options.url, "/!/account/"+Vault[this.vid].account[1]);
        request.write({
            'vault': vault,
            'vec': vec
        });
        request.setUnmodifiedSince(Vault[this.vid].modified);
        request.sign("account", Vault[this.vid].account);
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad() {
        console.log("updateVault onLoad");
        try {
            request.verify("account", Vault[this.vid].account);
            Vault[this.vid].modified = parseInt(request.responseJson['modified']);
            console.log(Vault[this.vid]); // DEBUG
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, null);
    }

    function onError(evt) {
        console.log("updateVault onError");
        var id;
        if ((retries <= 0) || (evt.detail.code != 412))
            return this.$emitEvent("error", errorCallback, evt.detail);
        try {
            request.verify("account", Vault[this.vid].account);
            if (request.responseJson['vault'] && request.responseJson['vec']) {
                // NOTE If decrupting fails, most probably the account credentials have been changed.
                // TODO Ask for password and generate new account credentials.
                vault = JSON.parse(this.crypto.decryptData(request.responseJson['vault'], Vault[this.vid].account[3], request.responseJson['vec']));
                vault = this.$upgradeVault(vault);
                // NOTE Add and update items
                for (id in vault.tickets) {
                    if ((!Vault[this.vid].tickets[id]) || (vault.tickets[id][0] > Vault[this.vid].tickets[id][0]))
                        Vault[this.vid].tickets[id] = vault.tickets[id]; 
                }
                for (id in vault.invitations) {
                    if ((!Vault[this.vid].invitations[id]) || (vault.invitations[id][0] > Vault[this.vid].invitations[id][0]))
                        Vault[this.vid].invitations[id] = vault.invitations[id]; 
                }
                for (id in vault.exchanges) {
                    if ((!Vault[this.vid].exchanges[id]) || (vault.exchanges[id][0] > Vault[this.vid].exchanges[id][0]))
                        Vault[this.vid].exchanges[id] = vault.exchanges[id]; 
                }
                // NOTE Remove items
                for (id in Vault[this.vid].tickets) {
                    if (!vault.tickets[id] && (Vault[this.vid].tickets[id][0] > Vault[this.vid].modified))
                        delete Vault[this.vid].tickets[id];
                }
                for (id in Vault[this.vid].invitations) {
                    if (!vault.invitations[id] && (Vault[this.vid].invitations[id][0] > Vault[this.vid].modified))
                        delete Vault[this.vid].invitations[id];
                }
                for (id in Vault[this.vid].exchanges) {
                    if (!vault.exchanges[id] && (Vault[this.vid].exchanges[id][0] > Vault[this.vid].modified))
                        delete Vault[this.vid].exchanges[id];
                }
            }
            Vault[this.vid].modified = parseInt(request.responseJson['modified']);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.updateVault(retries--, callback, errorCallback);
    }
}

// INFO Pod operations

Client.prototype.createPod = function(url, password, callback, errorCallback) {
    try {
        var request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
        request.open("POST", this.options.url, "/!/pod");
        request.write({
            'url': url
        });
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad() {
        this.$emitEvent("load", callback, request.responseJson);
    }
}

// INFO Domain operations

Client.prototype.createDomain = function(pod, password, callback, errorCallback) {
    try {
        var iid, ikeyL, request;
        iid = this.crypto.generateTimestamp();
        ikeyL = this.crypto.generateKeypair();
        request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this), onerror);
        request.open("POST", this.options.url, "/!/domain");
        request.write({
            'pod': pod,
            'iid': iid,
            'ikey_l': ikeyL.publicKey
        });
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad() {
        try {
            var pkey, ikey_, invitation;
            if (iid != request.responseJson['iid'])
                throw new Error("leaf and pod iid mismatch");
            if (ikeyL.publicKey != request.responseJson['ikey_l'])
                throw new Error("leaf and pod ikeyL mismatch");
            pkey = this.crypto.generateSecureHash(password, request.responseJson['psalt']);
            // TODO Activate pod authorization
            // request.authorize("pod", [null,null,pkey,null]);
            ikey_ = this.crypto.combineKeypair(ikeyL.privateKey, request.responseJson['ikey_p']);
            Vault[this.vid].invitations[request.responseJson['iid']] = [
                Date.now(),                            // NOTE invitation[0] = modified timestamp
                request.responseJson['iid'],           // NOTE invitation[1] = invitation id
                this.crypto.generateHmac(ikey_, pkey), // NOTE invitation[2] = invitation key
                null                                   // NOTE invitation[1] = invitation signature
            ];
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
            return;
        }
        this.$emitEvent("load", callback, {
            'iid': request.responseJson['iid']
        });
    }
}

Client.prototype.deleteDomain = function(did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        try {
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("DELETE", this.options.url, "/!/domain/"+did);
            request.write(undefined, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            delete Vault[this.vid].tickets[request.responseJson['did']];
            delete Vault[this.vid].streams[request.responseJson['did']];
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

// INFO Ticket operations

Client.prototype.createTicket = function(iid, callback, errorCallback) {
    console.log("createTicket");
    var iidUrl, tkeyL, request;
    try {
        iidUrl = iid.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
        tkeyL = this.crypto.generateKeypair();
        request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
        request.open("PUT", this.options.url, "/!/invitation/"+iidUrl);
        request.write({
            'tkey_l': tkeyL.publicKey
        });
        request.sign("invitation", Vault[this.vid].invitations[iid]);
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad(evt) {
        console.log("createTicket onLoad");
        var tkey;
        try {
            request.verify("invitation", Vault[this.vid].invitations[iid]);
            tkey = this.crypto.combineKeypair(tkeyL.privateKey, request.responseJson['tkey_p'])
            Vault[this.vid].tickets[request.responseJson['did']] = [
                Date.now(),                     // NOTE ticket[0] = modified timestamp
                request.responseJson['tid'],    // NOTE ticket[1] = ticket id
                tkey,                           // NOTE ticket[2] = ticket key
                request.responseJson['tflags'], // NOTE ticket[3] = ticket flags
                request.responseJson['did']     // NOTE ticket[4] = domain id
            ];
            delete Vault[this.vid].invitations[iid];
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, {
            'tid': Vault[this.vid].tickets[request.responseJson['did']][1],
            'tflags': Vault[this.vid].tickets[request.responseJson['did']][3],
            'did': Vault[this.vid].tickets[request.responseJson['did']][4]
        });
    }
}

Client.prototype.readTickets = function(tids, did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        try {
            tids = tids||"*";
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("GET", this.options.url, "/!/domain/"+did+"/ticket/"+tids);
            request.write(undefined, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            request.decrypt(Vault[this.vid].streams[did]);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

Client.prototype.updateTickets = function(tids, data, did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        var iidUrl;
        try {
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("PUT", this.options.url, "/!/domain/"+did+"/ticket/"+tids);
            request.write(data, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            request.decrypt(Vault[this.vid].streams[did]);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

Client.prototype.deleteTickets = function(tids, did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        var iidUrl;
        try {
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("DELETE", this.options.url, "/!/domain/"+did+"/ticket/"+tids);
            request.write(undefined, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        var i;
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            request.decrypt(Vault[this.vid].streams[did]);
            for (i=0; i<request.responseJson.length; i++)
                if (Vault[this.vid].tickets[did][1] == request.responseJson[i]['tid'])
                    delete Vault[this.vid].tickets[did];
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

// INFO Invitation operations

// TODO Use /!/domain/did/invitation/iid as URL
Client.prototype.createInvitation = function(invitation, did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        var iidUrl;
        try {
            iidUrl = invitation['iid'].replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("POST", this.options.url, "/!/invitation/"+iidUrl);
            request.write(invitation, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            request.decrypt(Vault[this.vid].streams[did]);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

Client.prototype.createPrivateInvitation = function(tflags, did, callback, errorCallback) {
    this.createInvitation({
        'iid': this.crypto.generateKey(),
        'ikey': this.crypto.generateKey(),
        'did': did,
        'tflags': tflags
    }, did, callback, afterCreateInvitationError.bind(this));
    
    function afterCreateInvitationError(error) {
        if (error.code == 409)
            this.createPrivateInvitation(tflags, did, callback, errorCallback);
        else
            this.$emitEvent("error", errorCallback, error);
        return false; // NOTE Prevent event
    }
}

Client.prototype.acceptPrivateInvitation = function(iid, ikey, callback, errorCallback) {
    Vault[this.vid].invitations[iid] = [ 
        Date.now(), // NOTE invitation[0] = modified timestamp
        iid,        // NOTE invitation[1] = invitation id
        ikey,       // NOTE invitation[2] = invitation key
        null        // NOTE invitation[1] = invitation signature
    ];
    this.$emitEvent("load", callback, {
        'iid': iid
    });
}

Client.prototype.createPublicInvitation = function(tflags, did, callback, errorCallback) {
    var xid, xkeyS, xsaltS;
    try {
        xkeyS = this.crypto.generateKeypair();
        xsaltS = this.crypto.generateKey();
        do {
            xid = Math.floor(Math.random() * 65535);
        } while (Vault[this.vid].exchanges[xid]);
        Vault[this.vid].exchanges[xid] = [
            Date.now(),       // NOTE exchange[0] = modified timestamp
            xid,              // NOTE exchange[1] = exchange id
            xkeyS.privateKey, // NOTE exchange[2] = exchange private sender key
            xsaltS,           // NOTE exchange[3] = exchange sender salt
            did,              // NOTE exchange[4] = domain id
            tflags            // NOTE exchange[5] = ticket flags
        ];
    }
    catch (e) {
        return this.$emitEvent("error", errorCallback, e);
    }
    this.$emitEvent("load", callback, {
        'xid': xid,
        'xkeyS': xkeyS.publicKey,
        'xsaltS': xsaltS
    });
}

Client.prototype.acceptPublicInvitation = function(xid, xkeyS, xsaltS, callback, errorCallback) {
    var xkeyR, xsaltR, xkey, xstr, xsig, iid, ikey;
    try {
        xkeyR = this.crypto.generateKeypair();
        xkey = this.crypto.combineKeypair(xkeyR.privateKey, xkeyS);
        do {
            xsaltR = this.crypto.generateKey();
            iid = this.crypto.generateHmac(xsaltR, xkey);
        } while (Vault[this.vid].invitations[iid]);
        ikey = this.crypto.generateHmac(xsaltS, xkey);
        xstr = this.crypto.concatenateStrings(xid, xsaltS, xsaltR);
        xsig = this.crypto.generateHmac(xstr, xkey);
        Vault[this.vid].invitations[iid] = [ 
            Date.now(), // NOTE invitation[0] = modified timestamp
            iid,        // NOTE invitation[1] = invitation id
            ikey,       // NOTE invitation[2] = invitation key
            xsig        // NOTE invitation[1] = invitation signature
        ];
    }
    catch (e) {
        return this.$emitEvent("error", errorCallback, e);
    }
    this.$emitEvent("load", callback, {
        'iid': iid,
        'xid': xid,
        'xkeyR': xkeyR.publicKey,
        'xsaltR': xsaltR,
        'xsig': xsig
    });
}

Client.prototype.confirmPublicInvitation = function(xid, xkeyR, xsaltR, xsigR, xsigL, callback, errorCallback) {
    var xkeyS, xsaltS, xkey, xstr, xsig;
    try {
        if (!Vault[this.vid].exchanges[xid])
            throw new Error("exchange id not found");
        xkeyS = Vault[this.vid].exchanges[xid][2];
        xsaltS = Vault[this.vid].exchanges[xid][3];
        xkey = this.crypto.combineKeypair(xkeyS, xkeyR);
        if (xsigR) {
            xstr = this.crypto.concatenateStrings(xid, xsaltS, xsaltR);
            xsig = this.crypto.generateHmac(xstr, xkey);
            if (xsig.substr(0, xsigL) != xsigR)
                throw new Error("exchange signatures mismatch");
        }
        else {
            console.warn("Exchange signature check skipped!");
        }
    }
    catch (e) {
        return this.$emitEvent("error", errorCallback, e);
    }
    this.createInvitation({
        'iid': this.crypto.generateHmac(xsaltR, xkey),
        'ikey': this.crypto.generateHmac(xsaltS, xkey),
        'did': Vault[this.vid].exchanges[xid][4],
        'tflags': Vault[this.vid].exchanges[xid][5]
    }, Vault[this.vid].exchanges[xid][4], afterCreateInvitation.bind(this), errorCallback);
    
    function afterCreateInvitation(response) {
        delete Vault[this.vid].exchanges[xid];
        this.$emitEvent("load", callback, response);
        return false; // NOTE Prevent event
    }
}

// NOTE We're using callbacks here with regard to further changes.
Client.prototype.readPendingInvitation = function(iid, callback, errorCallback) {
    var response;
    try {
        response = {
            'iid': Vault[this.vid].invitations[iid][1],
            'signature': Vault[this.vid].invitations[iid][3],
            'modified': Vault[this.vid].invitations[iid][0]
        };
    }
    catch (e) {
        return this.$emitEvent("error", errorCallback, e);
    }
    this.$emitEvent("load", callback, response);
}

// NOTE We're using callbacks here with regard to further changes.
Client.prototype.deletePendingInvitation = function(ttl, iid, callback, errorCallback) {
    var  response, deadline, modified;
    try {
        deadline = Date.now();
        modified = parseInt(Vault[this.vid].invitations[iid][0]);
        if (!ttl || modified+ttl < deadline) {
            response = {
                'iid': Vault[this.vid].invitations[iid][1],
                'signature': Vault[this.vid].invitations[iid][3],
                'modified': Vault[this.vid].invitations[iid][0]
            }
            delete Vault[this.vid].invitations[iid];
        }
    }
    catch (e) {
        return this.$emitEvent("error", errorCallback, e);
    }
    this.$emitEvent("load", callback, response||null);
}

// INFO Stream operations

Client.prototype.openStream = function(did, callback, errorCallback) {
    var request, skeyL;
    if (Vault[this.vid].streams[did])
        return this.$emitEvent("load", callback, did);
    try {
        skeyL = this.crypto.generateKeypair();
        request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
        request.open("POST", this.options.url, "/!/domain/"+did+"/leaf");
        request.write({
            'skey_l': skeyL.publicKey
        });
        request.sign("ticket", Vault[this.vid].tickets[did]);
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad(evt) {
        var skey, sid;
        try {
            request.verify("ticket", Vault[this.vid].tickets[did]);
            skey = this.crypto.combineKeypair(skeyL.privateKey, request.responseJson['skey_p']);
            sid = this.crypto.generateHmac(request.responseJson['ssalt'], skey);
            Vault[this.vid].streams[request.responseJson['did']] = [
                Date.now(),                     // NOTE stream[0] = modified timestamp
                sid,                            // NOTE stream[1] = stream id
                skey,                           // NOTE stream[2] = stream key
                request.responseJson['tflags'], // NOTE stream[3] = ticket flags
                request.responseJson['did']     // NOTE stream[4] = domain id
            ];
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        return this.$emitEvent("load", callback, request.responseJson['did']);
    }

    function onError(evt) {
        if (evt.detail.code == 401) {
            // TODO Check pod signature
            delete Vault[this.vid].tickets[did];
            this.updateVault(afterUpdateVault.bind(this), errorCallback);
        }
        else {
            this.$emitEvent("error", errorCallback, evt.detail);
        }

        function afterUpdateVault() {
            return this.$emitEvent("load", callback, null);
        }
    }
}

// INFO Entity operations

// TODO Implement some kind of caching to reduce HEAD requests
Client.prototype.resolveEntities = function(path, callback, errorCallback) {
    var dids, request, did;
    try {
        if (!path.match(/\/\w+\/\*/)) {
            request = this.$createRequest(undefined, undefined, errorCallback, onLoad.bind(this), undefined);
            request.open("HEAD", this.options.url, path);
            return request.send();
        }
        dids = new Array();
        for (did in Vault[this.vid].tickets)
            dids.push(parseInt(did));
    }
    catch (e) {
        return this.$emitEvent("error", errorCallback, e);
    }
    this.$emitEvent("load", callback, dids);

    function onLoad(evt) {
        try {
            dids = new Array();
            if (request.responseType.options && request.responseType.options['did']) {
                request.responseType.options['did'].replace(/(\d+)(?=,|$)/g, function(m, p) {
                    p = parseInt(p);
                    if (Vault[this.vid].tickets[p])
                        dids.push(p);
                    return false;
                }.bind(this));
            }
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, dids);
    }
}

// TODO Use same data format like for updateEntities
Client.prototype.createEntity = function(path, data, did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        try {
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("POST", this.options.url, path);
            request.write(data, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            request.decrypt(Vault[this.vid].streams[did]);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

Client.prototype.readEntities = function(path, did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        try {
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("GET", this.options.url, path);
            request.write(undefined, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            request.decrypt(Vault[this.vid].streams[did]);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

Client.prototype.updateEntities = function(path, data, did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        try {
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("PUT", this.options.url, path);
            request.write(data, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            request.decrypt(Vault[this.vid].streams[did]);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

Client.prototype.deleteEntities = function(path, did, callback, errorCallback) {
    var retries, request;
    retries = 3;
    this.openStream(did, afterOpenStream.bind(this), errorCallback);
    
    function afterOpenStream(did) {
        try {
            request = this.$createRequest(undefined, undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("DELETE", this.options.url, path);
            request.write(undefined, Vault[this.vid].streams[did]);
            request.sign("stream", Vault[this.vid].streams[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        return false; // NOTE Prevent event
    }

    function onLoad(evt) {
        try {
            request.verify("stream", Vault[this.vid].streams[did]);
            request.decrypt(Vault[this.vid].streams[did]);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, request.responseJson);
    }
    
    function onError(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return this.openStream(did, afterOpenStream.bind(this), errorCallback);
        }
        this.$emitEvent("error", errorCallback, evt.detail);
    }
}

// INFO Convenience functions

Client.prototype.$callMethodForEachId = function(method, args, ids, callback, errorCallback) {
    var responses, errors, lock, pointer, i;
    if (ids.length == 0)
        return this.$emitEvent("load", callback, null);
    lock = ids.length;
    responses = new Array();
    errors = new Array();
    pointer = args.length;
    args.push(null);
    args.push(afterMethod.bind(this));
    args.push(afterMethodError.bind(this));
    for (i = 0; i < ids.length; i++) {
        args[pointer] = ids[i];
        method.apply(this, args);
    }

    function afterMethod(response) {
        if (response)
            responses.push(response);
        if (--lock == 0)
            finalize.call(this);
        return false; // NOTE Prevent event
    }	

    function afterMethodError(error) {
        errors.push(error);
        if (--lock == 0)
            finalize.call(this);
        return false; // NOTE Prevent event
    }	

    function finalize() {
        if (responses.length > 0)
            this.$emitEvent("load", callback, responses);
        else if (errors.length == 0)
            this.$emitEvent("load", callback, null);
        if (errors.length > 0)
            this.$emitEvent("error", errorCallback, errors);
    }
}

Client.prototype.$resolvePathAndCallMethod = function(method, args, path, callback, errorCallback) {
    var responses, errors, lock;
    this.resolveEntities(path, afterResolveEntities.bind(this), errorCallback);

    function afterResolveEntities(dids) {
        this.$callMethodForEachId(method, args, dids, callback, errorCallback);
        return false; // NOTE Prevent event
    }
}

Client.prototype.$callMethodAndSyncVault = function(method, args, callback, errorCallback) {
    args.push(afterMethodApply.bind(this));
    args.push(errorCallback);
    method.apply(this, args);

    function afterMethodApply(responses) {
        this.updateVault(afterUpdateVault.bind(this), errorCallback);
        return false; // NOTE Prevent event

        function afterUpdateVault(response) {
            this.$emitEvent("load", callback, responses);
            return false; // NOTE Prevent event
        }
    }
}

// INFO Domain convenience functions

Client.prototype.deleteAndSyncDomain = function(did, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.deleteDomain, [did], callback, errorCallback);
}

Client.prototype.deleteDomains = function(dids, callback, errorCallback) {
    this.$callMethodForEachId(this.deleteDomain, [], dids, callback, errorCallback);
}

Client.prototype.deleteAndSyncDomains = function(dids, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.deleteDomains, [dids], callback, errorCallback);
}

Client.prototype.resolveAndDeleteDomains = function(path, callback, errorCallback) {
    this.$resolvePathAndCallMethod(this.deleteDomain, [], path, callback, errorCallback);
}

Client.prototype.resolveDeleteAndSyncDomains = function(path, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.resolveAndDeleteDomains, [path], callback, errorCallback);
}

// INFO Ticket convenience functions

Client.prototype.createAndSyncTicket = function(iid, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.createTicket, [iid], callback, errorCallback);
}

Client.prototype.createTickets = function(iids, callback, errorCallback) {
    iids = iids||Object.keys(Vault[this.vid].invitations);
    this.$callMethodForEachId(this.createTicket, [], iids, callback, errorCallback);
}

Client.prototype.createAndSyncTickets = function(iids, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.createTickets, [iids], callback, errorCallback);
}

Client.prototype.deleteAndSyncTickets = function(tids, did, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.deleteTickets, [tids, did], callback, errorCallback);
}

// INFO Invitation convenience functions

// TODO Handle collision, if an exchange with the same xid has been created since the last update.
Client.prototype.createAndSyncPublicInvitation = function(tflags, did, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.createPublicInvitation, [tflags, did], callback, errorCallback);
}

// TODO Handle collision, if an invitation with the same iid has been created since the last update.
Client.prototype.acceptAndSyncPublicInvitation = function(xid, xkeyS, xsaltS, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.acceptPublicInvitation, [xid, xkeyS, xsaltS], callback, errorCallback);
}

Client.prototype.confirmAndSyncPublicInvitation = function(xid, xkeyR, xsaltR, xsigR, xsigL, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.confirmPublicInvitation, [xid, xkeyR, xsaltR, xsigR, xsigL], callback, errorCallback);
}

Client.prototype.readPendingInvitations = function(iids, callback, errorCallback) {
    iids = iids||Object.keys(Vault[this.vid].invitations);
    this.$callMethodForEachId(this.readPendingInvitation, [], iids, callback, errorCallback);
}

Client.prototype.deletePendingInvitations = function(ttl, iids, callback, errorCallback) {
    iids = iids||Object.keys(Vault[this.vid].invitations);
    this.$callMethodForEachId(this.deletePendingInvitation, [ttl], iids, callback, errorCallback);
}

Client.prototype.deleteAndSyncPendingInvitations = function(ttl, iids, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.deletePendingInvitations, [ttl, iids], callback, errorCallback);
}

// INFO Entity convenience functions

Client.prototype.resolveAndReadEntities = function(path, callback, errorCallback) {
    this.$resolvePathAndCallMethod(this.readEntities, [path], path, callback, errorCallback);
}

Client.prototype.resolveAndUpdateEntities = function(path, data, callback, errorCallback) {
    this.$resolvePathAndCallMethod(this.updateEntities, [path, data], path, callback, errorCallback);
}

Client.prototype.resolveAndDeleteEntities = function(path, data, callback, errorCallback) {
    this.$resolvePathAndCallMethod(this.deleteEntities, [path, data], path, callback, errorCallback);
}

// INFO Mixed convenience functions

Client.prototype.acceptCreateAndSyncPrivateInvitationAndTicket = function(xid, xkey, callback, errorCallback) {
    this.acceptPrivateInvitation(xid, xkey, afterAcceptPrivateInvitation.bind(this), errorCallback);

    function afterAcceptPrivateInvitation(response) {
        console.log("afterAcceptPrivateInvitation");
        this.createAndSyncTicket(response['iid'], callback, errorCallback);
        return false; // NOTE Prevent event
    }
}

Client.prototype.createAndSyncDomainAndTicket = function(url, password, callback, errorCallback) {
    this.createDomain(url, password, afterCreateDomain.bind(this), errorCallback);

    function afterCreateDomain(response) {
        this.createAndSyncTicket(response['iid'], callback, errorCallback);
        return false; // NOTE Prevent event
    }
}

Client.prototype.createAndSyncDomainTicketAndEntity = function(url, password, path, data, callback, errorCallback) {
    this.createAndSyncDomainAndTicket(url, password, afterCreateAndSyncDomainAndTicket.bind(this), errorCallback);

    function afterCreateAndSyncDomainAndTicket(response) {
        this.createEntity(path, data, response['did'], callback, errorCallback);
        return false; // NOTE Prevent event
    }
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Client : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Client=Client;

})();
