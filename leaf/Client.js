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
    switch (vault.version.join(".")) {
        default:
            // NOTE Version 0.2.2
            vault.exchange = vault.exchange||new Object();
            vault.invitation = vault.invitation||new Object();
            for (id in vault.domain)
                vault.domain[id]['modified'] = vault.domain[id]['timestamp']||Date.now(); 
            for (id in vault.exchange)
                vault.exchange[id]['modified'] = vault.exchange[id]['timestamp']||Date.now(); 
            for (id in vault.invitation)
                vault.invitation[id]['modified'] = vault.invitation[id]['timestamp']||Date.now(); 
            // NOTE Version 0.2.3
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
                    vault.invitation[id]['ikey']
                ];
            }
            for (var id in vault.exchange) {
                vault.exchanges[id] = [
                    vault.exchange[id]['modified'],
                    vault.exchange[id]['xid'],
                    vault.exchange[id]['xkey'],
                    vault.exchange[id]['xsig']
                ];
            }
            delete vault.domain;
            delete vault.invitation;
            delete vault.exchange;
        case "0.2.3":
            // add upgrades for version 0.2.4 here
    }
    vault.version = "0.2.3";
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
        var akey, asec, vault;
        try {
            console.log(request.responseJson);
            asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), request.responseJson['asalt']);
            vault = JSON.parse(this.crypto.decryptData(request.responseJson['vault'], asec, request.responseJson['vec']));
            vault = this.$upgradeVaultTo2_2_2(vault);
            vault.modified = parseInt(request.responseJson['modified']); 
            vault = this.$upgradeVaultTo2_2_3(vault);
            vault.streams = new Object();
            vault.account.push(asec); // NOTE account[2] = account secret 
            Vault[this.vid] = vault;
            console.log(Vault[this.vid]);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
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
    var alias, asalt, akeyL, request;
    try {
        alias = this.crypto.generateSecureHash(name, password);
        asalt = this.crypto.generateKey();
        akeyL = this.crypto.generateKeypair();
        request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this));
        request.open("POST", this.options.url, "/!/account");
        request.writeJson({
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
        this.updateVault(3, afterUpdateVault.bind(this), errorCallback);
    
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

Client.prototype.updateVault = function(retries, callback, errorCallback) {
    var vec, vault, request;
    try {
        vec = this.crypto.generateTimestamp();
        // NOTE This JSON dance is necessary to create a real clone.
        vault = JSON.parse(JSON.stringify(Vault[this.vid]));
        vault.account.pop(); // NOTE Remove the account secret at account[3] 
        delete vault.streams;
        delete vault.modified;
        vault = this.crypto.encryptData(JSON.stringify(vault), Vault[this.vid].account[3], vec);
        request = this.$createRequest(null, callback, errorCallback, onLoad.bind(this), onError.bind(this));
        request.open("PUT", this.options.url, "/!/account/"+Vault[this.vid].account[1]);
        request.writeJson({
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
        request.writeJson({
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
        request.writeJson({
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
            console.log(request.responseJson);
            pkey = this.crypto.generateSecureHash(password, request.responseJson['psalt']);
            //request.authorizePod(pkey);
            ikey_ = this.crypto.combineKeypair(ikeyL.privateKey, request.responseJson['ikey_p']);
            invitation = {
                'iid': request.responseJson['iid'],
                'ikey': this.crypto.generateHmac(ikey_, pkey)
            };
            Vault[this.vid].invitation[request.responseJson['iid']] = invitation;
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
            return;
        }
        // NOTE An error in the callback would emit a client error event,
        //      if the callback call happens within the try block.
        this.$emitEvent("load", callback, invitation);
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
        try {
            var request;
            request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
            request.open("DELETE", this.options.url, "/!/domain/"+did);
            request.writeEncrypted(undefined);
            request.signDomain();
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

        function onLoad() {
            console.log("TODO authorizeStream()");
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

// INFO Ticket operations

Client.prototype.createTicket = function(invitation, callback, errorCallback) {
    try {
        var iidUrl, tkeyL, request, domain;
        iidUrl = invitation['iid'].replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
        tkeyL = this.crypto.generateKeypair();
        request = this.$createRequest(invitation, callback, errorCallback, onLoad.bind(this));
        request.open("PUT", this.options.url, "/!/invitation/"+iidUrl);
        request.writeJson({
            'tkey_l': tkeyL.publicKey
        });
        request.signInvitation();
        request.send();
    }
    catch (e) {
        this.$emitEvent("error", errorCallback, e);
    }

    function onLoad(result) {
        if (!request.authorizeInvitation())
            return this.$emitEvent("error", errorCallback, new Error("invitation authorization failed"));
        domain = {
            'did': request.responseJson['did'],
            'tid': request.responseJson['tid'],
            'tkey': this.crypto.combineKeypair(tkeyL.privateKey, request.responseJson['tkey_p']),
            'tflags': request.responseJson['tflags'],
            'modified': Date.now()
        };
        Vault[this.vid].domain[domain['did']] = domain;
        // TODO Move into conveniance
        this.updateVault(afterUpdateVault.bind(this));
    }
    
    function afterUpdateVault() {
        this.$emitEvent("load", callback, {'did':domain['did'],'tid':domain['tid']});
    }
}

Client.prototype.readTickets = function(did, tids, callback, errorCallback) {
    this.$registerLeaf(did, afterRegisterLeaf.bind(this));

    function afterRegisterLeaf(error) {
        try {
            var request;
            if (error)
                return this.$emitEvent("error", errorCallback, evt.detail);
            request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
            request.open("GET", this.options.url, "/!/domain/"+did+"/ticket/"+(tids?tids:"*"));
            request.writeEncrypted();
            request.signTicket();
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

        function onLoad(result) {
            if (!request.authorizeTicket())
                return this.$emitEvent("error", errorCallback, new Error("ticket authorization failed"));
            this.$emitEvent("load", callback, request.responseEncrypted);
        }

        function onError(evt) {
            switch (evt.detail.code) {
                case 401:
                    delete Vault[this.vid].domain[did];
                    return this.updateVault(afterRegisterLeaf.bind(this));
                case 412:
                    return this.$refreshLeaf(did, afterRegisterLeaf.bind(this));
                default:
                    this.$emitEvent("error", errorCallback, evt.detail);
            }
        }
    }
}
Client.prototype.updateTickets = function(did, data, callback, errorCallback) {
    this.$registerLeaf(did, afterRegisterLeaf.bind(this));

    function afterRegisterLeaf(error) {
        try {
            var request, tids;
            if (error)
                return this.$emitEvent("error", errorCallback, evt.detail);
            tids = new Array();
            for (var i=0; i<data.length; i++)
                tids.push(data[i]['tid']);
            request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
            request.open("PUT", this.options.url, "/!/domain/"+did+"/ticket/"+tids);
            request.writeEncrypted(data);
            request.signTicket();
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

        function onLoad(result) {
            if (!request.authorizeTicket())
                return this.$emitEvent("error", errorCallback, new Error("ticket authorization failed"));
            this.$emitEvent("load", callback, request.responseEncrypted);
        }

        function onError(evt) {
            if (evt.detail.code == 412)
                return this.$refreshLeaf(did, afterRegisterLeaf.bind(this));
            this.$emitEvent("error", errorCallback, evt.detail);
        }
    }
}

Client.prototype.deleteTickets = function(did, tids, callback, errorCallback) {
    this.$registerLeaf(did, afterRegisterLeaf.bind(this));

    function afterRegisterLeaf(error) {
        try {
            var request;
            if (error)
                return this.$emitEvent("error", errorCallback, evt.detail);
            request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
            request.open("DELETE", this.options.url, "/!/domain/"+did+"/ticket/"+tids);
            request.writeEncrypted();
            request.signTicket();
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

        function onLoad(result) {
            if (!request.authorizeTicket())
                return this.$emitEvent("error", errorCallback, new Error("ticket authorization failed"));
            this.$emitEvent("load", callback, request.responseEncrypted);
        }

        function onError(evt) {
            if (evt.detail.code == 412)
                return this.$refreshLeaf(did, afterRegisterLeaf.bind(this));
            this.$emitEvent("error", errorCallback, evt.detail);
        }
    }
}

// TODO Should be moved to convenience functions as soon as all convfuncs have error callbacks
Client.prototype.createPendingTickets = function(iids, callback, errorCallback) {
    var results, errors, iid, count;
    results = new Array();
    errors = new Array();
    count = 0;
    for (iid in Vault[this.vid].invitation) {
        if (!iids || (iids.indexOf(iid) != -1)) {
            count++;
            createTicketForInvitation.call(this, Vault[this.vid].invitation[iid]);
        }
    }

    function createTicketForInvitation(invitation) {
        // NOTE By removing the invitation from the vault before creating the
        //      ticket, we save the updateVault call after ticket creration,
        //      which would otherwise be required to save the vault after the
        //      invtation has been removed.
        delete Vault[this.vid].invitation[invitation['iid']];
        this.createTicket(invitation, afterCreateTicket.bind(this), afterCreateTicketError.bind(this));
        
        function afterCreateTicket(response) {
            results.push(response);
            if (--count <= 0)
                finalize.call(this);
            // NOTE Surpress global load event, which will be emitted by finalize().
            return false;
        }

        function afterCreateTicketError(error) {
            errors.push(error);
            // NOTE Restore the previously removed invitation.
            Vault[this.vid].invitation[invitation['iid']] = invitation;
            if (--count <= 0)
                finalize.call(this);
            // NOTE Surpress global error event, which will be emitted by finalize().
            return false;
        }
    }

    function finalize() {
        console.log(errors);
        console.log(results);
        if (errors.length)
            this.$emitEvent("error", errorCallback, errors);
        if (results.length)
            this.$emitEvent("load", callback, results);
    }
}

// INFO Invitation operations

// NOTE This function uses the only callback and won't dispatch any events. 
Client.prototype.$storeInvitation = function(invitation, callback) {
    var iidUrl;
    console.log(invitation);
    iidUrl = invitation['iid'].replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    this.$registerLeaf(invitation['did'], afterRegisterLeaf.bind(this));

    function afterRegisterLeaf(error) {
        try {
            var request;
            if (error)
                return this.$emitEvent("error", errorCallback, evt.detail);
            request = this.$createRequest(Vault[this.vid].domain[invitation['did']], undefined, undefined, onLoad.bind(this), onError.bind(this));
            request.open("POST", this.options.url, "/!/invitation/"+iidUrl);
            request.writeEncrypted(invitation);
            request.signTicket();
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

        function onLoad(result) {
            if (!request.authorizeTicket())
                return callback(new Error("ticket authorization failed"));
            callback(null, invitation);
        }

        function onError(evt) {
            if (evt.detail.code == 412)
                return this.$refreshLeaf(did, afterRegisterLeaf.bind(this));
            callback(evt.detail);
        }
    }
}

Client.prototype.createPrivateInvitation = function(did, tflags, callback, errorCallback) {
    this.$storeInvitation({
        'iid': this.crypto.generateKey(),
        'ikey': this.crypto.generateKey(),
        'did': did,
        'flags': tflags
    }, afterStoreInvitation.bind(this));

    function afterStoreInvitation(error, invitation) {
        if (error)
            this.$emitEvent("error", errorCallback, error);
        else
            this.$emitEvent("load", callback, invitation);
    }
}

Client.prototype.createPublicInvitation = function(did, tflags, callback, errorCallback) {
    var xid, xkeyS, xsaltS;
    xkeyS = this.crypto.generateKeypair();
    xsaltS = this.crypto.generateKey();
    storeExchange.call(this);

    function storeExchange() {
        do {
            xid = Math.floor(Math.random() * 65535);
        } while (Vault[this.vid].exchange[xid]);
        Vault[this.vid].exchange[xid] = {
            'xkeyS': xkeyS.privateKey,
            'xsaltS': xsaltS,
            'did': did,
            'tflags': tflags,
            'modified': Date.now()
        };
        // TODO Handle xid collision, when another leaf created an
        //      exchange with the same xid since the last update.
        this.updateVault(afterUpdateVault.bind(this), errorCallback);
    }
    
    function afterUpdateVault() {
        this.$emitEvent("load", callback, {
            'xid': xid,
            'xkeyS': xkeyS.publicKey,
            'xsaltS': xsaltS
        });
    }
}

Client.prototype.acceptPublicInvitation = function(xid, xkeyS, xsaltS, callback, errorCallback) {
    var xkeyR, xsaltR, xkey, xstr, xsig, iid, ikey;
    xkeyR = this.crypto.generateKeypair();
    xsaltR = this.crypto.generateKey();
    xkey = this.crypto.combineKeypair(xkeyR.privateKey, xkeyS);
    xstr = this.crypto.concatenateStrings(xid, xsaltS, xsaltR);
    xsig = this.crypto.generateHmac(xstr, xkey);
    iid = this.crypto.generateHmac(xsaltS, xkey);
    ikey = this.crypto.generateHmac(xsaltR, xkey);
    Vault[this.vid].invitation[iid] = {
        'iid': iid,
        'ikey': ikey,
        'xsig': xsig,
        'modified': Date.now()
    };
    this.updateVault(afterUpdateVault.bind(this), errorCallback);
    
    function afterUpdateVault() {
        this.$emitEvent("load", callback, {
            'xid': xid,
            'xkeyR': xkeyR.publicKey,
            'xsaltR': xsaltR
        });
    }
}

Client.prototype.confirmPublicInvitation = function(xid, xkeyR, xsaltR, xsigR, xsigL, callback, errorCallback) {
    var xkeyS, xsaltS, xkey, xstr, xsig, invitation;
    if (!Vault[this.vid].exchange[xid])
        return this.$emitEvent("error", errorCallback, new Error("exchange id not found"));
    xkeyS = Vault[this.vid].exchange[xid]['xkeyS'];
    xsaltS = Vault[this.vid].exchange[xid]['xsaltS'];
    xkey = this.crypto.combineKeypair(xkeyS, xkeyR);
    xstr = this.crypto.concatenateStrings(xid, xsaltS, xsaltR);
    if (xsigR) {
        xsig = this.crypto.generateHmac(xstr, xkey);
        console.log(xsig);
        console.log(xsigR);
        console.log(xsig.substr(0, xsigL));
        if (xsig.substr(0, xsigL) != xsigR)
            return this.$emitEvent("error", errorCallback, new Error("exchange checksums mismatch"));
    }
    else {
        console.warn("Exchange checksum comparision skipped!");
    }
    this.$storeInvitation({
        'iid': this.crypto.generateHmac(xsaltS, xkey),
        'ikey': this.crypto.generateHmac(xsaltR, xkey),
        'did': Vault[this.vid].exchange[xid]['did'],
        'tflags': Vault[this.vid].exchange[xid]['tflags']
    }, afterStoreInvitation.bind(this));

    function afterStoreInvitation(error, response) {
        if (error)
            return this.$emitEvent("error", errorCallback, error);
        invitation = response;
        delete Vault[this.vid].exchange[xid];
        this.updateVault(afterUpdateVault.bind(this), errorCallback);

    }
    
    function afterUpdateVault() {
        this.$emitEvent("load", callback, invitation);
    }
}

// NOTE We're using a callback here with regard to further changes.
Client.prototype.readPendingInvitations = function(iids, callback, errorCallback) {
    var invitation, response, iid;
    response = new Array();
    for (iid in Vault[this.vid].invitation) {
        if (!iids || (iids.indexOf(iid) != -1)) {
            response.push({
                'iid': iid,
                'xsig': Vault[this.vid].invitation[iid]['xsig'],
                'timestamp': Vault[this.vid].invitation[iid]['modified']
            });
        }
    }
    this.$emitEvent("load", callback, response);
}

Client.prototype.deletePendingInvitations = function(iids, callback, errorCallback) {
    var invitation, response, iid;
    response = new Array();
    for (iid in Vault[this.vid].invitation) {
        if (!iids || (iids.indexOf(iid) != -1)) {
            delete Vault[this.vid].invitation[iid];
            response.push(iid);
        }
    }
    this.updateVault(afterUpdateVault.bind(this), errorCallback);
    
    function afterUpdateVault() {
        this.$emitEvent("load", callback, response);
    }
}

Client.prototype.clearPendingInvitations = function(iids, ttl, callback, errorCallback) {
    var  response, iid, deadline, modified;
    response = new Array();
    deadline = Date.now();
    for (iid in Vault[this.vid].invitation) {
        if (!iids || (iids.indexOf(iid) != -1)) {
            modified = parseInt(Vault[this.vid].invitation[iid]['modified']);
            if (modified+ttl < deadline) {
                delete Vault[this.vid].invitation[iid];
                response.push(iid);
            }
        }
    }
    this.updateVault(afterUpdateVault.bind(this), errorCallback);
    
    function afterUpdateVault() {
        this.$emitEvent("load", callback, response);
    }
}

// INFO Entity operations

// NOTE This function uses the only callback and won't dispatch any events. 
Client.prototype.$refreshLeaf = function(did, callback) {
    var request, skeyL;
    try {
        skeyL = this.crypto.generateKeypair();
        request = this.$createRequest(Vault[this.vid].domain[did], undefined, undefined, onLoad.bind(this), onError.bind(this));
        request.open("POST", this.options.url, "/!/domain/"+did+"/leaf");
        request.writeJson({
            'skey_l': skeyL.publicKey
        });
        request.signTicket();
        request.send();
    }
    catch (e) {
        callback(e, null);
    }

    function onLoad(evt) {
        var skey, sid;
        try {
            request.authorizeTicket();
            skey = this.crypto.combineKeypair(skeyL.privateKey, request.responseJson['skey_p']);
            sid = this.crypto.generateHmac(request.responseJson['ssalt'], skey);
            Vault[this.vid].streams[request.responseJson['did']] = {
                'sid': sid,
                'skey': skey,
                'tflags': request.responseJson['tflags'] 
            };
        }
        catch (e) {
            callback(e, null);
        }
        callback(null, request.responseJson['did']);
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
    try {
        var request;
        request = this.$createRequest(null, undefined, undefined, onLoad.bind(this), onError.bind(this));
        request.open("HEAD", this.options.url, path);
        request.send();
    }
    catch (e) {
        callback(e, null);
    }

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
    match = path.match(/^((?:\/\w+\/\d+)+?)?\/\w+(\/\d+(?:\?hard)?)?$/);
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
        if (!did)
            return onError.call(this, {'detail':new Error("undefined domain id")});
        try {
            request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
            request.open("POST", this.options.url, path);
            request.writeEncrypted(data);
            request.signTicket();
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

        function onLoad() {
            // NOTE If match[2] is set only a relation operation took place on the node
            if (match[2])
                this.$emitEvent("load", callback, request.responseJson);
            else {
                if (!request.authorizeTicket())
                    this.$emitEvent("error", errorCallback, new Error("anthorization failed"));
                else
                    this.$emitEvent("load", callback, request.responseEncrypted);
            }
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
        try {
            request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
            request.open("GET", this.options.url, path);
            request.writeEncrypted();
            request.signTicket(Vault[this.vid].domain[did]);
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

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
            switch (evt.detail.code) {
                case 401:
                    delete Vault[this.vid].domain[did];
                    return this.updateVault(function(){
                        count++;
                        if (length-count == 0)
                            finalize.call(this);
                    }.bind(this));
                case 412:
                    return this.$refreshLeaf(did, function(error, did) {
                        afterResolvePath.call(this, error, did, index, length);
                    }.bind(this));
                default:
                    count++;
                    errors.push(evt.detail);
                    if (length-count == 0)
                        finalize.call(this);
            }
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
        try {
            request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
            request.open("PUT", this.options.url, path);
            request.writeEncrypted(data);
            request.signTicket();
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

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
            switch (evt.detail.code) {
                case 401:
                    delete Vault[this.vid].domain[did];
                    return this.updateVault(function(){
                        if (length-count == 0)
                            finalize.call(this);
                    }.bind(this));
                case 412:
                    return this.$refreshLeaf(did, function(error, did) {
                        afterResolvePath.call(this, error, did, index, length);
                    }.bind(this));
                default:
                    count++;
                    errors.push(evt.detail);
                    if (length-count == 0)
                        finalize.call(this);
            }
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
        try {
            request = this.$createRequest(Vault[this.vid].domain[did], callback, errorCallback, onLoad.bind(this), onError.bind(this));
            request.open("DELETE", this.options.url, path);
            request.writeEncrypted(undefined);
            request.signTicket();
            request.send();
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }

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
            switch (evt.detail.code) {
                case 401:
                    delete Vault[this.vid].domain[did];
                    return this.updateVault(function(){
                        if (length-count == 0)
                            finalize.call(this);
                    }.bind(this));
                case 412:
                    return this.$refreshLeaf(did, function(error, did) {
                        afterResolvePath.call(this, error, did, index, length);
                    }.bind(this));
                default:
                    count++;
                    errors.push(evt.detail);
                    if (length-count == 0)
                        finalize.call(this);
            }
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
        'invitation': null,
        'ticket': null,
        'entity': null
    }
    this.createDomain(url, password, afterCreateDomain.bind(this), afterCreateDomainError.bind(this));

    function afterCreateDomain(result) {
        results.invitation = result;
        this.createTicket(result, afterCreateTicket.bind(this));
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

    function afterCreateTicket(result) {
        results.ticket = result;
        this.updateVault(afterUpdateVault.bind(this));
    }

    function afterUpdateVault() {
        data['did'] = results.ticket['did'];
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
