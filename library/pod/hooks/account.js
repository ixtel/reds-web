"use strict";

var HttpError = require("../../shared/HttpError");

exports.GET = function(session) {
	var alias = (new Buffer(session.purl[0].value, 'base64')).toString('base64');
	session.storage.readAccount(alias, session.domain.intercept(afterReadAccount));

	function afterReadAccount(result) {
		if (result == null) {
			throw new HttpError(404, "alias not found");
		}
		session.writeJSON(result);
		session.end();
	}
}

exports.POST = function(session) {
	var akeyP = session.crypto.generateKeypair();
	var akey = session.crypto.combineKeypair(akeyP.privateKey, session.requestJSON['akey_l']);
	var values = Object.create(session.requestJSON);
	values['akey'] = akey;
	values['akey_l'] = undefined;
	console.log(JSON.stringify(values));
	session.storage.createPodAccount(values, session.domain.bind(afterCreateAccount));

	function afterCreateAccount(error, result) {
		if (error !== null) {
			switch (error.code) {
				case "23505":
					throw new HttpError(409, "id already exists");
				default:
					throw error;
			}
		}
		var check = "TODO calculate check";
		var values = new Object();
		values['akey_p'] = akeyP.publicKey;
		values['check'] = check;
		session.writeJSON(values);
		session.end();
	}
}
