"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
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
        values['tflags'] = session.authorization.invitation['tflags'];
        delete values['tkey_l'];
        session.storage.createTicket(values, afterCreateTicket);
    }

    function afterCreateTicket(error, result) {
        if (error !== null)
            return session.abort(error);
        ticket = result;
        ticket['tkey_p'] = tkeyP.publicKey;
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
