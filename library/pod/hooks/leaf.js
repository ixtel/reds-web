"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
	session.authorizeDomain(afterAuthorization);

	function afterAuthorization(error) { 
		var vecP, vec, lsalt, lid;
		if (error)
			return session.abort(error);
		vecP = session.crypto.generateKeypair();
		vec = session.crypto.combineKeypair(vecP.privateKey, session.requestJson['vec_l']);
		do {
			lsalt = session.crypto.generateKey();
			lid = session.crypto.generateHmac(vec, lsalt);
		} while (session.leafs.items[lid]);
		session.leafs.setItem(lid, {
			'did': parseInt(session.selector[0].value),
			'vec': vec
		});
		session.writeJson({
			'vec_p': vecP.publicKey,
			'lsalt': lsalt
		});
		session.signDomain();
		session.end();
	}
}
