"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.POST = function(session) {
	var route, domain;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.init(session.requestJSON['pod']);

	function onRouteReady() {
		session.storage.registerDomain({
			'pid': route.pod['pid']
		}, afterRegisterDomain);
	}

	function afterRegisterDomain(error, result) {
		if (error)
			return session.abort(error);
		domain = {
			'did': result['did'],
			'dkey_l': session.requestJSON['dkey_l']
		};
		route.method = "POST";
		route.path = "/!/domain/"+domain['did'];
		route.writeJson(domain);
		route.send();
	}

	function onRouteResponse() {
		session.write(route.responseText, route.responseType);
		session.end();
	}

	function onRouteError(error) {
		if (domain)
			session.storage.deleteDomain(domain['did'], function() {
				session.abort(new HttpError(502, error.message));
			});
		else
			session.abort(new HttpError(502, error.message));
	}
}

exports.DELETE = function(session) {
	var route;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		route.method = "DELETE";
		route.path = "/!/domain/"+session.type.options['did'];
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		session.storage.unregisterDomain(session.type.options['did'], afterUnregisterDomain);
	}

	function afterUnregisterDomain(error, result) {
		session.write(route.responseText, route.responseType);
		session.end();
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}
}
