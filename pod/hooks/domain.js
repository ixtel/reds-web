"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
    var pkey, ikeyP, ikey_;
    session.storage.createDomain({
        'did': session.requestJson['did']
    }, afterCreateDomain);

    function afterCreateDomain(error, result) {
        if (error !== null)
            return session.abort(error);
        if (error !== null) {
            // TODO Error type should be returned by storage facility
            switch (error.code) {
                case "23505":
                    return session.abort(new HttpError(409, "did already exists"));
                default:
                    return session.abort(error);
            }
        }
        pkey = session.crypto.generateSecureHash(session.config['password'], session.config['salt']);
        ikeyP = session.crypto.generateKeypair();
        ikey_ = session.crypto.combineKeypair(ikeyP.privateKey, session.requestJson['ikey_l']);
        session.storage.createInvitation({
            'iid': session.requestJson['iid'],
            'ikey': session.crypto.generateHmac(ikey_, pkey),
            'tflags': 0xFF, // NOTE 0xFF marks the owner ticket
            'did': session.requestJson['did'] 
        }, afterCreateInvitation);
    }

    function afterCreateInvitation(error, result) {
        if (error !== null)
            return session.abort(error);
        var values = {
            'iid': result['iid'],
            'ikey_l': session.requestJson['ikey_l'],
            'ikey_p': ikeyP.publicKey,
            'psalt': session.config['salt']
        };
        console.log(values);
        session.writeJson(values);
        //session.signPod();
        session.end();
    }
}

exports.DELETE = function(session) {
    session.authorizeStream(afterAuthorization);

    function afterAuthorization(error) { 
        if (error)
            return session.abort(error);
        session.storage.deleteDomain(session.type.options['did'], afterDeleteDomain);
    }

    function afterDeleteDomain(error, result) {
        if (error !== null)
            return session.abort(error);
        session.writeEncrypted(result);
        session.signStream();
        session.end();
    }
}
