"use strict";

var HttpError = require("../../shared/HttpError");

exports.GET = function(session) {
	var alias = (new Buffer(session.purl[0].value, 'base64')).toString('base64');
	session.storage.readAccount(alias, afterReadAccount);

	function afterReadAccount(result) {
		if (result == null) {
			session.aboirt(new HttpError(404, "alias not found"));
		}
		session.writeJSON(result);
		session.end();
	}
}

exports.POST = function(session) {
	var pkey, dkeyP, dkey, values;
	pkey = session.crypto.generateSecureHash(session.config['password'], session.config['salt']);
	dkeyP = session.crypto.generateKeypair();
	dkey = session.crypto.combineKeypair(dkeyP.privateKey, session.requestJSON['dkey_l'], pkey);
	// NOTE We don't want to modify requestJSON so we create our own JSON object here
	values = JSON.parse(session.requestText);
	values['dkey'] = dkey;
	delete values['dkey_l'];
	console.log(values);
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
