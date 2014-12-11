"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
	var authP, auth, values, node;
	authP = session.crypto.generateKeypair();
	auth = session.crypto.combineKeypair(authP.privateKey, session.requestJson['auth_n']);
	// NOTE We don't want to modify requestJson so we create our own JSON object here
	values = JSON.parse(session.requestText);
	values['auth'] = auth;
	delete values['auth_n'];
	delete values['types'];
	session.storage.createNode(values, afterCreateNode.bind(this));

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
		node = result
		delete node['auth'];
		node['auth_p'] = authP.publicKey;
		session.storage.createNamespace(node['namespace'], session.requestJson['types'], afterCreateNamespace.bind(this));
	}

	function afterCreateNamespace(error) {
		if (error) {
			if (node) {
				return session.storage.deleteNode(node['nid'], function(err) {
					// NOTE Simply logging the error is probably not the best way to handle it ;)
					if (err)
						console.error(err);
					session.abort(error[0]||error);
				});
			}
			return session.abort(error[0]||error);
		}
		session.writeJson(node);
		session.end();
	}
}
