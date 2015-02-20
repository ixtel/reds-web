"use strict";

var HttpError = require("../../../shared/HttpError");

exports.POST = function(session) {
    return session.authorizeStream(afterAuthorization);

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
        session.signStream();
        session.end();
    }
}
