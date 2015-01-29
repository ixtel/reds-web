"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
    session.authorizeTicket(parseInt(session.selector[0].value), afterAuthorization);

    function afterAuthorization(error) { 
        var skeyP, skey, ssalt, sid;
        if (error)
            return session.abort(error);
        skeyP = session.crypto.generateKeypair();
        skey = session.crypto.combineKeypair(skeyP.privateKey, session.requestJson['skey_l']);
        do {
            ssalt = session.crypto.generateKey();
            sid = session.crypto.generateHmac(ssalt, skey);
        } while (session.leafs.items[sid]);
        session.leafs.setItem(sid, {
            'sid': sid,
            'skey': skey,
            'did': parseInt(session.selector[0].value),
            'tflags': session.authorization.ticket['tflags']
        });
        session.writeJson({
            'skey_p': skeyP.publicKey,
            'ssalt': ssalt,
            'did': parseInt(session.selector[0].value),
            'tflags': session.authorization.ticket['tflags']
        });
        session.signTicket();
        session.end();
    }
}
