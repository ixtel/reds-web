"use strict";

var HttpError = require("../../../shared/HttpError");

exports.POST = function(session) {
    session.authorizeTicket(parseInt(session.selector[0].value), afterAuthorization);

    function afterAuthorization(error) { 
        var skeyP, skey, ssalt, sid;
        if (error)
            return session.abort(error);
        if (parseInt(session.selector[0].value) !== session.requestJson['did'])
            return session.abort(new Error("body and url domain mismatch"));
        skeyP = session.crypto.generateKeypair();
        skey = session.crypto.combineKeypair(skeyP.privateKey, session.requestJson['skey_l']);
        do {
            ssalt = session.crypto.generateKey();
            sid = session.crypto.generateHmac(ssalt, skey);
        } while (session.streams.items[sid]);
        session.streams.setItem(sid, {
            'sid': sid,
            'skey': skey,
            'did': session.requestJson['did'],
            'tid': session.authorization.ticket['tid'],
            'tflags': session.authorization.ticket['tflags']
        });
        session.writeJson({
            'skey_p': skeyP.publicKey,
            'ssalt': ssalt,
            'did': session.requestJson['did'],
            'tflags': session.authorization.ticket['tflags']
        });
        session.signTicket();
        session.end();
    }
}
