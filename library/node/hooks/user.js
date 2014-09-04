"use strict";

exports.GET = function(session) {
	console.log("GET user");
	session.storageFacility.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.writeJSON({
			'id': Math.floor(Math.random()*1000)
		});
		session.end();
	}
}

exports.POST = function(session) {
	console.log("POST user");
	session.storageFacility.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.writeJSON({
			'id': Math.floor(Math.random()*1000)
		});
		session.end();
	}
}

exports.PUT = function(session) {
	console.log("PUT user");
	session.storageFacility.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.writeJSON({
			'id': Math.floor(Math.random()*1000)
		});
		session.end();
	}
}

exports.DELETE = function(session) {
	console.log("DELETE user");
	session.storageFacility.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.end();
	}
}
