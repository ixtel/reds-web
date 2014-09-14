"use strict";

var SessionError = require("../../shared/SessionError");

exports.GET = function(session) {
	console.log("GET user");
	session.storage.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.writeJSON({
			'id': Math.floor(Math.random()*1000)
		});
		session.end();
	}
}

exports.POST = function(session) {
	console.log("POST user");
	session.storage.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		var authN = session.crypto.generateKeypair();
		var auth = session.crypto.combineKeypair(authN.privateKey, session.requestJSON['auth_l']);
		var values = Object.create(session.requestJSON);
		values['auth'] = auth;
		values['auth_n'] = authN.publicKey;
		session.storage.createAccount(values, session.domain.bind(afterCreateAccount));
	}

	function afterCreateAccount(error, result) {
		if (error !== null) {
			switch (error.code) {
				case "23505":
					throw new SessionError(409, "alias already exists");
				default:
					throw error;
			}
		}
		session.writeJSON(result);
		session.end();
	}
}

exports.PUT = function(session) {
	console.log("PUT user");
	session.storage.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.writeJSON({
			'id': Math.floor(Math.random()*1000)
		});
		session.end();
	}
}

exports.DELETE = function(session) {
	console.log("DELETE user");
	session.storage.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.end();
	}
}
