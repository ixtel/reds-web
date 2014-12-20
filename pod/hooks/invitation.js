"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
    return session.authorizeTicket(afterAuthorization);

    function afterAuthorization(error) { 
        var values;
        if (error)
            return session.abort(error);
        // NOTE We don't want to modify requestEncrypted so we clone it
        values = JSON.parse(JSON.stringify(session.requestEncrypted));
        // NOTE Convert iid in url from base64url to base64
        values['iid'] = (new Buffer(session.selector.last.value, 'base64')).toString('base64'),
        session.storage.createInvitation(values, afterCreateInvitation);
    }

    function afterCreateInvitation(error, result) {
        if (error !== null)
                return session.abort(error);
        session.writeEncrypted(result);
        session.signTicket();
        session.end();
    }
}

exports.PUT = function(session) {
    var tkeyP, ticket;
    session.authorizeInvitation(afterAuthorization);

    function afterAuthorization(error) {
        var tkey, values;
        if (error)
            return session.abort(error);
        tkeyP = session.crypto.generateKeypair();
        tkey = session.crypto.combineKeypair(tkeyP.privateKey, session.requestJson['tkey_l']);
        // NOTE We don't want to modify requestJson so we clone it
        values = JSON.parse(JSON.stringify(session.requestJson));
        values['did'] = session.authorization['invitation']['did'];
        values['tkey'] = tkey;
        values['tflags'] = session.authorization.invitation['iflags'];
        delete values['tkey_l'];
        session.storage.createTicket(values, afterCreateTicket);
    }

    function afterCreateTicket(error, result) {
        if (error !== null)
            return session.abort(error);
        ticket = result;
        ticket['tkey_p'] = tkeyP.publicKey;
        ticket['dkey'] = session.crypto.encryptData(ticket['dkey'], session.authorization.invitation['ikey'], session.authorization.invitation['iid']);
        session.storage.deleteInvitation(session.authorization.invitation['iid'], afterDeleteInvitation.bind(this));
    }

    function afterDeleteInvitation(error, result) {
        if (error !== null)
            return session.abort(error);
        session.writeJson(ticket);
        session.signInvitation();
        session.end();
    }
}
