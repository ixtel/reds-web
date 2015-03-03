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
    if (!callback || callback(detail) !== false)
        this.dispatchEvent(new CustomEvent(name, {'detail':detail}));
    return false; // NOTE To use "return this.$emitEvent" to prevent the callback event
}

Client.prototype.$sendRequest = function(options, hooks, callback, errorCallback) {
    send.call(this);

    function send() {
        var outfunc, request;
        try {
            if (hooks.prepare)
                outfunc = hooks.prepare(options);
        }
        catch (e) {
            this.$emitEvent("error", errorCallback, e);
        }
        if ((typeof(outfunc) !== 'function') || (outfunc.call(this) !== false)) {
            try {
                request = new Request(this, options);
                request.addEventListener("load", onLoad.bind(this));
                request.addEventListener("error", onError.bind(this));
                request.write(options.data);
                this.dispatchEvent(new Event("send"));
                request.send();
            }
            catch (e) {
                this.$emitEvent("error", errorCallback, e);
            }
        }
    }

    function onLoad(evt) {
        var outfunc;
        try {
            if (hooks.load)
                outfunc = hooks.load(evt);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        if ((typeof(outfunc) !== 'function') || (outfunc.call(this) !== false))
            this.$emitEvent("load", callback, evt.detail.data);
    }
    
    function onError(evt) {
        var outfunc;
        try {
            if (hooks.error)
                outfunc = hooks.error(evt);
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, [evt.detail, e]);
        }
        if ((typeof(outfunc) !== 'function') || (outfunc.call(this) !== false))
            this.$emitEvent("error", errorCallback, evt.detail);
    }
}

Client.prototype.$sendStreamRequest = function(options, hooks, did, callback, errorCallback) {
    var retries;
    retries = 3;
    start.call(this);

    function start() {
        this.openStream(did, afterOpenStream.bind(this), errorCallback);
        return false; // NOTE Block $emitEvent
    }
    
    function afterOpenStream(did) {
        if (!did)
            this.$emitEvent("load", callback, null);
        this.$sendRequest({
            'method': options.method,
            'path': options.path,
            'data': options.data,
            'realm': "stream",
            'credentials': Vault[this.vid].streams[did]
        }, {
            'prepare': hooks.prepare,
            'load': hooks.load,
            'error': errorHook.bind(this)
        }, callback, errorCallback);
        return false; // NOTE Prevent event
    }
    
    function errorHook(evt) {
        if (evt.detail.code == 412) {
            delete Vault[this.vid].streams[did];
            if (--retries >= 0)
                return start.bind(this);
        }
        return hooks.error && hooks.error(evt);
    }
}

Client.prototype.signin = function(name, password, callback, errorCallback) {
    this.$sendRequest({
        'method': "GET",
        'path': "/!/account/"
    }, {
        'prepare': prepareHook.bind(this),
        'load': loadHook.bind(this)
    }, callback, errorCallback);

    function prepareHook(options) {
        var alias;
        alias = this.crypto.generateSecureHash(name, password);
        options['path'] += alias.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    }

    function loadHook(evt) {
        var akey, asec;
        asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), evt.detail.data['asalt']);
        Vault[this.vid] = JSON.parse(this.crypto.decryptData(evt.detail.data['vault'], asec, evt.detail.data['vec']));
        Vault[this.vid] = this.$upgradeVault(Vault[this.vid]);
        Vault[this.vid].modified = parseInt(evt.detail.data['modified']); 
        Vault[this.vid].streams = new Object();
        Vault[this.vid].account.push(asec); // NOTE account[2] = account secret 
        evt.detail.data = {'aid':Vault[this.vid].account[1]};
    }
}

Client.prototype.signout = function(callback) {
    Vault.resetClient(this.vid);
    // NOTE Always call the callback asynchronously
    setTimeout(function() {
        this.$emitEvent("load", callback, null);
    }, 0);
}

// INFO Account operations

Client.prototype.createAccount = function(name, password, callback, errorCallback) {
    var asalt, akeyL;
    this.$sendRequest({
        'method': "POST",
        'path': "/!/account",
        'data': null
    }, {
        'prepare': prepareHook.bind(this),
        'load': loadHook.bind(this)
    }, callback, errorCallback);

    function prepareHook(options) {
        var alias;
        alias = this.crypto.generateSecureHash(name, password);
        asalt = this.crypto.generateKey();
        akeyL = this.crypto.generateKeypair();
        options.data = {
            'alias': alias,
            'asalt': asalt,
            'akey_l': akeyL.publicKey
        };
    }

    function loadHook(evt) {
        var akey, asec;
        akey = this.crypto.combineKeypair(akeyL.privateKey, evt.detail.data['akey_n']);
        asec = this.crypto.generateSecureHash(this.crypto.concatenateStrings(name, password), asalt);
        Vault[this.vid] = {
            'account': [
                Date.now(),             // NOTE account[0] = modified timestamp
                evt.detail.data['aid'], // NOTE account[1] = account id
                akey,                   // NOTE account[2] = account key
                asec                    // NOTE account[3] = account secret
            ],
            'streams': {},
            'tickets': {},
            'invitations': {},
            'exchanges': {},
            'version': [0,2,3],
            'modified': evt.detail.data['modified']
        };
        evt.detail.data = {'aid':Vault[this.vid].account[1]};
    }
}

Client.prototype.deleteAccount = function(callback, errorCallback) {
    this.$sendRequest({
        'method': "DELETE",
        'path': "/!/account/"+Vault[this.vid].account['aid']
    }, {
        'load': loadHook.bind(this),
    }, callback, errorCallback);

    function loadHook(evt) {
        Vault.resetClient(this.vid);
    }
}

Client.prototype.updateVault = function(callback, errorCallback) {
    var retries;
    retries = 3;
    start.call(this);

    function start() {
        this.$sendRequest({
            'method': "PUT",
            'path': "/!/account/"+Vault[this.vid].account[1],
            'realm': "account",
            'credentials': Vault[this.vid].account
        }, {
            'prepare': prepareHook.bind(this),
            'load': loadHook.bind(this),
            'error': errorHook.bind(this),
        }, callback, errorCallback);
        return false; // NOTE Block $emitEvent when called from errorHook
    }

    function prepareHook(options) {
        var vec, vault;
        vec = this.crypto.generateTimestamp();
        //console.log("Current vault: "+JSON.stringify(Vault[this.vid])); // DEBUG
        // NOTE This JSON dance is necessary to create a real clone.
        vault = JSON.parse(JSON.stringify(Vault[this.vid]));
        vault.account.pop(); // NOTE Remove the account secret at account[3] 
        delete vault.streams;
        delete vault.modified;
        vault = this.crypto.encryptData(JSON.stringify(vault), Vault[this.vid].account[3], vec);
        options.data = {
            'vault': vault,
            'modified': Vault[this.vid].modified,
            'vec': vec
        };
    }

    function loadHook(evt) {
        Vault[this.vid].modified = parseInt(evt.detail.data['modified']);
        //console.log("Updated vault: "+JSON.stringify(Vault[this.vid])); // DEBUG
    }

    function errorHook(evt) {
        var vault, id;
        if ((evt.detail.code == 412) && (--retries > 0)) {
            console.info("vault has been updated by a forgein leaf, merging vaults");
            // NOTE If decrypting fails, most probably the account credentials have been changed.
            // TODO Ask for password and generate new account credentials.
            vault = JSON.parse(this.crypto.decryptData(evt.detail.data['vault'], Vault[this.vid].account[3], evt.detail.data['vec']));
            vault = this.$upgradeVault(vault);
            //console.log("Newer vault: "+JSON.stringify(vault)); // DEBUG
            // NOTE Add and update items
            for (id in vault.tickets) {
                if (vault.tickets[id][0] > Vault[this.vid].modified)
                    Vault[this.vid].tickets[id] = vault.tickets[id]; 
            }
            for (id in vault.invitations) {
                if (vault.invitations[id][0] > Vault[this.vid].modified)
                    Vault[this.vid].invitations[id] = vault.invitations[id]; 
            }
            for (id in vault.exchanges) {
                if (vault.exchanges[id][0] > Vault[this.vid].modified)
                    Vault[this.vid].exchanges[id] = vault.exchanges[id]; 
            }
            // NOTE Remove items
            for (id in Vault[this.vid].tickets) {
                if (!vault.tickets[id] && (Vault[this.vid].tickets[id][0] < Vault[this.vid].modified))
                    delete Vault[this.vid].tickets[id];
            }
            for (id in Vault[this.vid].invitations) {
                if (!vault.invitations[id] && (Vault[this.vid].invitations[id][0] < Vault[this.vid].modified))
                    delete Vault[this.vid].invitations[id];
            }
            for (id in Vault[this.vid].exchanges) {
                if (!vault.exchanges[id] && (Vault[this.vid].exchanges[id][0] < Vault[this.vid].modified))
                    delete Vault[this.vid].exchanges[id];
            }
            Vault[this.vid].modified = parseInt(evt.detail.data['modified']);
            //console.log("Merged vault: "+JSON.stringify(Vault[this.vid])); // DEBUG
            return start.bind(this);
        }
    }
}

// INFO Pod operations

Client.prototype.createPod = function(url, password, callback, errorCallback) {
    this.$sendRequest({
        'method': "POST",
        'path': "/!/pod",
        'data': {
            'url': url
        }
    }, {}, callback, errorCallback);
}

// INFO Domain operations

Client.prototype.createDomain = function(pod, password, callback, errorCallback) {
    var iid, ikeyL;
    this.$sendRequest({
        'method': "POST",
        'path': "/!/domain",
        'realm': "pod",
        'credentials': password
    }, {
        'prepare': prepareHook.bind(this),
        'load': loadHook.bind(this)
    }, callback, errorCallback);

    function prepareHook(options) {
        iid = this.crypto.generateTimestamp();
        ikeyL = this.crypto.generateKeypair();
        options.data = {
            'pod': pod,
            'iid': iid,
            'ikey_l': ikeyL.publicKey
        };
    }

    function loadHook(evt) {
        var pkey, ikey_, msg;
        if (iid != evt.detail.data['iid'])
            throw new Error("leaf and pod iid mismatch");
        if (ikeyL.publicKey != evt.detail.data['ikey_l'])
            throw new Error("leaf and pod ikeyL mismatch");
        pkey = this.crypto.generateSecureHash(password, evt.detail.data['psalt']);
        ikey_ = this.crypto.combineKeypair(ikeyL.privateKey, evt.detail.data['ikey_p']);
        Vault[this.vid].invitations[evt.detail.data['iid']] = [
            Date.now(),                            // NOTE invitation[0] = modified timestamp
            evt.detail.data['iid'],                // NOTE invitation[1] = invitation id
            this.crypto.generateHmac(ikey_, pkey), // NOTE invitation[2] = invitation key
            null                                   // NOTE invitation[1] = invitation signature
        ];
        evt.detail.data = {
            'iid': evt.detail.data['iid']
        }
    }
}

Client.prototype.deleteDomain = function(did, callback, errorCallback) {
    this.$sendStreamRequest({
        'method': "DELETE",
        'path': "/!/domain/"+did
    }, {
        'load': loadHook.bind(this)
    }, did, callback, errorCallback);

    function loadHook(evt) {
        delete Vault[this.vid].tickets[evt.detail.data['did']];
        delete Vault[this.vid].streams[evt.detail.data['did']];
    }
}

// INFO Ticket operations

Client.prototype.createTicket = function(iid, callback, errorCallback) {
    var tkeyL;
    this.$sendRequest({
        'method': "POST",
        'path': "/!/ticket/"+iid.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''),
        'data': null,
        'realm': "invitation",
        'credentials': Vault[this.vid].invitations[iid]
    }, {
        'prepare': prepareHook.bind(this),
        'load': loadHook.bind(this)
    }, callback, errorCallback);

    function prepareHook(options) {
        tkeyL = this.crypto.generateKeypair();
        options.data = {
            'tkey_l': tkeyL.publicKey
        };
    }

    function loadHook(evt) {
        var tkey;
        tkey = this.crypto.combineKeypair(tkeyL.privateKey, evt.detail.data['tkey_p']);
        Vault[this.vid].tickets[evt.detail.data['did']] = [
            Date.now(),                // NOTE ticket[0] = modified timestamp
            evt.detail.data['tid'],    // NOTE ticket[1] = ticket id
            tkey,                      // NOTE ticket[2] = ticket key
            evt.detail.data['tflags'], // NOTE ticket[3] = ticket flags
            evt.detail.data['did']     // NOTE ticket[4] = domain id
        ];
        delete Vault[this.vid].invitations[iid];
        evt.detail.data = {
            'tid': Vault[this.vid].tickets[evt.detail.data['did']][1],
            'tflags': Vault[this.vid].tickets[evt.detail.data['did']][3],
            'did': Vault[this.vid].tickets[evt.detail.data['did']][4]
        };
    }
}

Client.prototype.readTickets = function(tids, did, callback, errorCallback) {
    tids = tids||"*";
    this.$sendStreamRequest({
        'method': "GET",
        'path': "/!/domain/"+did+"/ticket/"+tids
    }, {}, did, callback, errorCallback);
}

Client.prototype.updateTickets = function(tids, data, did, callback, errorCallback) {
    this.$sendStreamRequest({
        'method': "PUT",
        'path': "/!/domain/"+did+"/ticket/"+tids,
        'data': data
    }, {}, did, callback, errorCallback);
}

Client.prototype.deleteTickets = function(tids, did, callback, errorCallback) {
    this.$sendStreamRequest({
        'method': "DELETE",
        'path': "/!/domain/"+did+"/ticket/"+tids
    }, {}, did, callback, errorCallback);

    function loadHook(evt) {
        for (i=0; i<evt.detail.data.length; i++)
            if (Vault[this.vid].tickets[did][1] == evt.detail.data[i]['tid'])
                delete Vault[this.vid].tickets[did];
    }
}

// INFO Invitation operations

// NOTE Generic function that will be called from createInvitation() and confirmExchange()
Client.prototype.$createInvitation = function(invitation, did, callback, errorCallback) {
    this.$sendStreamRequest({
        'method': "POST",
        'path': null,      // NOTE Will be set in the prepare hook
        'data': invitation
    }, {
        'prepare': prepareHook,
        'error': errorHook
    }, did, callback, errorCallback);

    function prepareHook(options) {
        options.path = "/!/domain/"+did+"/invitation/"+invitation['iid'].replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    }

    function errorHook(evt) {
        if (evt.detail.code == 409) {
            this.$createInvitation(tflags, did, callback, errorCallback);
            return false;
        }
    }
}

Client.prototype.createInvitation = function(tflags, did, callback, errorCallback) {
    var invitation;
    try {
        invitation = {
            'iid': this.crypto.generateKey(),
            'ikey': this.crypto.generateKey(),
            'did': did,
            'tflags': tflags
        };
    }
    catch (e) {
        return this.$emitEvent("error", errorCallback, e);
    }
    this.$createInvitation(invitation, did, callback, afterCreateInvitationError.bind(this));
}

Client.prototype.acceptInvitation = function(ikey, iid, callback, errorCallback) {
    Vault[this.vid].invitations[iid] = [ 
        Date.now(), // NOTE invitation[0] = modified timestamp
        iid,        // NOTE invitation[1] = invitation id
        ikey,       // NOTE invitation[2] = invitation key
        null        // NOTE invitation[1] = invitation signature
    ];
    // NOTE Always call the callback asynchronously
    setTimeout(function() {
        this.$emitEvent("load", callback, {
            'iid': iid
        });
    }, 0);
}

Client.prototype.createExchange = function(tflags, did, callback, errorCallback) {
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
    // NOTE Always call the callback asynchronously
    setTimeout(function() {
        this.$emitEvent("load", callback, {
            'xid': xid,
            'xkeyS': xkeyS.publicKey,
            'xsaltS': xsaltS
        });
    }, 0);
}

Client.prototype.acceptExchange = function(xkeyS, xsaltS, xid, callback, errorCallback) {
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
    // NOTE Always call the callback asynchronously
    setTimeout(function() {
        this.$emitEvent("load", callback, {
            'iid': iid,
            'xid': xid,
            'xkeyR': xkeyR.publicKey,
            'xsaltR': xsaltR,
            'xsig': xsig
        });
    }, 0);
}

Client.prototype.confirmExchange = function(xkeyR, xsaltR, xsigR, xid, callback, errorCallback) {
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
            if (xsig.substr(0, xsigR.length) != xsigR)
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
    // NOTE Always call the callback asynchronously
    setTimeout(function() {
        this.$emitEvent("load", callback, response);
    }, 0);
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
    // NOTE Always call the callback asynchronously
    setTimeout(function() {
        this.$emitEvent("load", callback, response||null);
    }, 0);
}

// INFO Stream operations

Client.prototype.openStream = function(did, callback, errorCallback) {
    var skeyL;
    if (Vault[this.vid].streams[did])
        return this.$emitEvent("load", callback, did);
    if (Vault[this.vid].streams[did] === null)
        return setTimeout(waitForCompletion.bind(this), 100, Date.now());
    this.$sendRequest({
        'method': "POST",
        'path': "/!/domain/"+did+"/stream",
        'realm': "ticket",
        'credentials': Vault[this.vid].tickets[did]
    }, {
        'prepare': prepareHook.bind(this),
        'load': loadHook.bind(this),
        'error': errorHook.bind(this),
    }, callback, errorCallback);

    function prepareHook(options) {
        Vault[this.vid].streams[did] = null;
        skeyL = this.crypto.generateKeypair();
        options.data = {
            'skey_l': skeyL.publicKey
        };
    }

    function loadHook(evt) {
        var skey, sid;
        skey = this.crypto.combineKeypair(skeyL.privateKey, evt.detail.data['skey_p']);
        sid = this.crypto.generateHmac(evt.detail.data['ssalt'], skey);
        Vault[this.vid].streams[evt.detail.data['did']] = [
            Date.now(),                     // NOTE stream[0] = modified timestamp
            sid,                            // NOTE stream[1] = stream id
            skey,                           // NOTE stream[2] = stream key
            evt.detail.data['tflags'], // NOTE stream[3] = ticket flags
            evt.detail.data['did']     // NOTE stream[4] = domain id
        ];
        evt.detail.data = evt.detail.data['did'];
    }

    function errorHook(evt) {
        // TODO Return a 404 if the domain cannot be found and verify the
        //      deletion certificate of the domain (which is also a TODO)
        if (evt.detail.code==502 || evt.detail.code==401) {
            console.info("ticket or domain has been deleted by forgein leaf, cleaning vault")
            delete Vault[this.vid].tickets[did];
            delete Vault[this.vid].streams[did];
            return function() {
                this.updateVault(function() {
                    this.$emitEvent("load", callback, null);
                }.bind(this), errorCallback);
                return false; // NOTE Block $emitEvent
            };
        }
    }
    
    function waitForCompletion(start) {
        if (Vault[this.vid].streams[did])
            this.$emitEvent("load", callback, did);
        else if (start+Date.now() > start+60000)
            this.$emitEvent("error", errorCallback, new Error("stream creation timed out"));
        else
            setTimeout(waitForCompletion.bind(this), 100, start);
    }
}

// INFO Entity operations

// TODO Implement some kind of caching to reduce HEAD requests
Client.prototype.resolveEntities = function(path, callback, errorCallback) {
    if (path.match(/\/\w+\/\*/))
        return loadDirecty.call(this);
    this.$sendRequest({
        'method': "HEAD",
        'path': path,
    }, {
        'load': loadHook.bind(this),
    }, callback, errorCallback);

    function loadHook(evt) {
        var dids;
        dids = new Array();
        if (evt.detail.type.options && evt.detail.type.options['did']) {
            evt.detail.type.options['did'].replace(/(\d+)(?=,|$)/g, function(m, p) {
                p = parseInt(p);
                if (Vault[this.vid].tickets[p])
                    dids.push(p);
                return false;
            }.bind(this));
        }
        evt.detail.data = dids;
    }

    function loadDirecty() {
        var dids, did;
        try {
            dids = new Array();
            for (did in Vault[this.vid].tickets)
                dids.push(parseInt(did));
        }
        catch (e) {
            return this.$emitEvent("error", errorCallback, e);
        }
        this.$emitEvent("load", callback, dids);
    }
}

// TODO Use same data format like for updateEntities
Client.prototype.createEntity = function(path, data, did, callback, errorCallback) {
    this.$sendStreamRequest({
        'method': "POST",
        'path': path,
        'data': data
    }, {}, did, callback, errorCallback);
}

Client.prototype.readEntities = function(path, did, callback, errorCallback) {
    this.$sendStreamRequest({
        'method': "GET",
        'path': path,
    }, {}, did, callback, errorCallback);
}

Client.prototype.updateEntities = function(path, data, did, callback, errorCallback) {
    this.$sendStreamRequest({
        'method': "PUT",
        'path': path,
        'data': data
    }, {}, did, callback, errorCallback);
}

Client.prototype.deleteEntities = function(path, did, callback, errorCallback) {
    this.$sendStreamRequest({
        'method': "DELETE",
        'path': path
    }, {}, did, callback, errorCallback);
}

// INFO Convenience functions

Client.prototype.$callMethodForEachId = function(method, args, ids, callback, errorCallback) {
    var responses, errors, lock, pointer, i;
    if (ids.length == 0)
        return this.$emitEvent("load", callback, null);
    responses = new Array();
    errors = new Array();
    pointer = args.length;
    args.push(null);
    args.push(afterMethod.bind(this));
    args.push(afterMethodError.bind(this));
    if (Array.isArray(ids)) {
        lock = ids.length;
        for (i = 0; i < ids.length; i++) {
            args[pointer] = ids[i];
            method.apply(this, args);
        }
    }
    else {
        lock = 1;
        args[pointer] = ids;
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

    function afterMethodApply(response) {
        this.updateVault(afterUpdateVault.bind(this), afterUpdateVaultError.bind(this));
        return false; // NOTE Prevent event

        function afterUpdateVault() {
            this.$emitEvent("load", callback, response);
            return false; // NOTE Prevent event
        }

        function afterUpdateVaultError(error) {
            console.warn("TODO Revert changes made by method (vault out of sync!)");
            this.$emitEvent("error", errorCallback, error);
            return false; // NOTE Prevent event
        }
    }
}

// INFO Domain convenience functions

Client.prototype.deleteDomains = function(dids, callback, errorCallback) {
    this.$callMethodForEachId(this.deleteDomain, [], dids, callback, errorCallback);
}

Client.prototype.deleteAndSyncDomain = function(did, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.deleteDomain, [did], callback, errorCallback);
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

Client.prototype.createTickets = function(iids, callback, errorCallback) {
    iids = iids||Object.keys(Vault[this.vid].invitations);
    this.$callMethodForEachId(this.createTicket, [], iids, callback, errorCallback);
}

Client.prototype.createAndSyncTicket = function(iid, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.createTicket, [iid], callback, errorCallback);
}

Client.prototype.createAndSyncTickets = function(iids, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.createTickets, [iids], callback, errorCallback);
}

Client.prototype.deleteAndSyncTickets = function(tids, did, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.deleteTickets, [tids, did], callback, errorCallback);
}

// INFO Invitation convenience functions

// TODO Handle collision, if an exchange with the same xid has been created since the last update.
Client.prototype.createAndSyncExchange = function(tflags, did, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.createExchange, [tflags, did], callback, errorCallback);
}

// TODO Handle collision, if an invitation with the same iid has been created since the last update.
Client.prototype.acceptAndSyncExchange = function(xkeyS, xsaltS, xid, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.acceptExchange, [xkeyS, xsaltS, xid], callback, errorCallback);
}

Client.prototype.confirmAndSyncExchange = function(xkeyR, xsaltR, xsigR, xid, callback, errorCallback) {
    this.$callMethodAndSyncVault(this.confirmExchange, [xkeyR, xsaltR, xsigR, xid], callback, errorCallback);
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

Client.prototype.acceptCreateAndSyncInvitationAndTicket = function(ikey, iid, callback, errorCallback) {
    this.acceptInvitation(ikey, iid, afterAcceptInvitation.bind(this), errorCallback);

    function afterAcceptInvitation(response) {
        this.createAndSyncTicket(response['iid'], callback, errorCallback);
        return false; // NOTE Prevent event
    }
}

Client.prototype.createAndSyncDomainAndTicket = function(url, password, callback, errorCallback) {
    var retries;
    retries = 3;
    start.call(this);

    function start() {
        this.createDomain(url, password, afterCreateDomain.bind(this), afterCreateDomainError.bind(this));
    }

    function afterCreateDomain(response) {
        this.createAndSyncTicket(response['iid'], callback, errorCallback);
        return false; // NOTE Prevent event
    }

    function afterCreateDomainError(error) {
        if ((error.code == 502) && (--retries >= 0))
            this.createPod(url, password, start.bind(this), errorCallback);
        else
            this.$emitEvent("error", errorCallback, error);
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
