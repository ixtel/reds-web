"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
	session.authorizeDomain(afterAuthorization);

	function afterAuthorization(error) { 
		var vecP, vec, lsalt;
		if (error)
			return session.abort(error);
		vecP = session.crypto.generateKeypair();
		vec = session.crypto.combineKeypair(vecP.privateKey, session.requestJson['vec_l']);
		lsalt = session.crypto.generateKey();
		// TODO Store handshake
		session.writeJson({
			'vec_p': vecP.publicKey,
			'lsalt': lsalt
		});
		session.end();
	}
}
