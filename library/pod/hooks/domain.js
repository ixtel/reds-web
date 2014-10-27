"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
	var pkey, dkeyP, dkey, values;
	pkey = session.crypto.generateSecureHash(session.config['password'], session.config['salt']);
	dkeyP = session.crypto.generateKeypair();
	dkey = session.crypto.combineKeypair(dkeyP.privateKey, session.requestJSON['dkey_l'], pkey);
	// NOTE We don't want to modify requestJSON so we create our own JSON object here
	values = JSON.parse(session.requestText);
	values['dkey'] = dkey;
	delete values['dkey_l'];
	session.storage.createDomain(values, afterCreateDomain);

	function afterCreateDomain(error, result) {
		if (error !== null) {
			switch (error.code) {
				case "23505":
					return session.abort(new HttpError(409, "did already exists"));
				default:
					return session.abort(error);
			}
		}
		result['dkey_p'] = dkeyP.publicKey;
		result['psalt'] = session.config['salt'];
		session.writeJSON(result);
		session.end();
	}
}

exports.DELETE = function(session) {
	session.storage.deleteDomain(session.type.options['did'], afterDeleteDomain);

	function afterDeleteDomain(error, result) {
		if (error !== null)
			return session.abort(error);
		session.writeJSON(result, "application/x.reds.domain");
		session.end();
	}
}
