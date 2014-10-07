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
	var pkey = session.crypto.generateSecureHash(session.config['password'], session.config['salt']);
	var akeyP = session.crypto.generateKeypair();
	var akey = session.crypto.combineKeypair(akeyP.privateKey, session.requestJSON['akey_l'], pkey);
	var values = Object.create(session.requestJSON);
	values['akey'] = akey;
	values['akey_l'] = undefined;
	session.storage.createPodAccount(values, afterCreateAccount);

	function afterCreateAccount(error, result) {
		if (error !== null) {
			switch (error.code) {
				case "23505":
					return session.abort(new HttpError(409, "id already exists"));
				default:
					return session.abort(error);
			}
		}
		var values = new Object();
		values['akey_p'] = akeyP.publicKey;
		values['psalt'] = session.config['salt'];
		session.writeJSON(values);
		session.end();
	}
}
