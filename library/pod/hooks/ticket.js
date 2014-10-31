"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
	var tkeyP, tkey, values;
	tkeyP = session.crypto.generateKeypair();
	tkey = session.crypto.combineKeypair(tkeyP.privateKey, session.requestJson['tkey_l']);
	// NOTE We don't want to modify requestDomain so we clone it
	values = JSON.parse(JSON.stringify(session.requestDomain));
	values['did'] = session.selector[0].value;
	values['tkey'] = tkey;
	// TODO Set tflags correctly
	values['tflags'] = 0xFF;
	delete values['tkey_l'];
	session.storage.createTicket(values, afterCreateTicket);

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
		session.writeDomain(result);
		session.end();
	}
}
