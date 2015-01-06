"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
    var tkeyP;
    session.authorizeDomain(afterAuthorization);

    function afterAuthorization(error) { 
        var tkey, values;
        if (error)
            return session.abort(error);
        tkeyP = session.crypto.generateKeypair();
        tkey = session.crypto.combineKeypair(tkeyP.privateKey, session.requestJson['tkey_l']);
        // NOTE We don't want to modify requestJson so we clone it
        values = JSON.parse(JSON.stringify(session.requestJson));
        values['did'] = session.selector[0].value;
        values['tkey'] = tkey;
        values['tflags'] = 0xFF;
        delete values['tkey_l'];
        session.storage.createTicket(values, afterCreateTicket);
    }

    function afterCreateTicket(error, result) {
        if (error !== null) {
            // TODO Error type should be returned by storage facility
            switch (error.code) {
                case "23505":
                    return session.abort(new HttpError(409, "tid already exists"));
                default:
                    return session.abort(error);
            }
        }
        result['tkey_p'] = tkeyP.publicKey;
        delete result['dkey'];
        session.writeJson(result);
        session.signDomain();
        session.end();
    }
}

exports.GET = function(session) {
    session.authorizeTicket(afterAuthorization);

    function afterAuthorization(error) {
        var tids;
        if (error)
            session.abort(error);
        if (session.selector.last.value == "*")
            tids = null;
        else
            tids = session.selector.last.value.split(",");
        session.storage.readTickets(tids, session.authorization.domain['did'], afterCreateTicket);
    }

    function afterCreateTicket(error, result) {
        session.writeEncrypted(result);
        session.signTicket();
        session.end();
    }
}

exports.PUT = function(session) {
    session.authorizeTicket(afterAuthorization);

    function afterAuthorization(error) {
        if (error)
            session.abort(error);
        session.storage.updateTickets(session.requestEncrypted, session.authorization.domain['did'], afterCreateTicket);
    }

    function afterCreateTicket(error, result) {
        session.writeEncrypted(result);
        session.signTicket();
        session.end();
    }
}

exports.DELETE = function(session) {
    session.authorizeTicket(afterAuthorization);

    function afterAuthorization(error) {
        var tids;
        if (error)
            session.abort(error);
        tids = session.selector.last.value.split(",");
        session.storage.deleteTickets(tids, session.authorization.domain['did'], afterCreateTicket);
    }

    function afterCreateTicket(error, result) {
        session.writeEncrypted(result);
        session.signTicket();
        session.end();
    }
}
