"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
	var authP = session.crypto.generateKeypair();
	var auth = session.crypto.combineKeypair(authP.privateKey, session.requestJson['auth_n']);
	// NOTE We don't want to modify requestJson so we create our own JSON object here
	var values = JSON.parse(session.requestText);
	values['auth'] = auth;
	delete values['auth_n'];
	session.storage.createNode(values, afterCreateNode);

	function afterCreateNode(error, result) {
		if (error !== null) {
			// TODO Error type should be returned by storage facility
			switch (error.code) {
				case "23505":
					return session.abort(new HttpError(409, "namespace already exists"));
				default:
					return session.abort(error);
			}
		}
		result['auth_p'] = authP.publicKey;
		session.writeJson(result);
		session.end();
	}
}
