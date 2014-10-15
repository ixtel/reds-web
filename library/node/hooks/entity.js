"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

// TODO Handle child entities
exports.POST = function(session) {
	var type, route, entity;
	type = session.purl[session.purl.length-1].key;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.ptype.options['did']);

	function onRouteReady() {
		session.storage.registerEntity(type, {
			'did': session.ptype.options['did']
		}, afterRegisterEntity);
	}

	function afterRegisterEntity(error, result) {
		if (error)
			return session.abort(error);
		route.method = "POST";
		route.path = "/"+type+"/"+result['eid'];
		route.send(session.requestText, session.request.headers['content-type']);
	}

	function onRouteResponse() {
		// TODO Pass content type
		session.writeJSON(route.responseJson);
		session.end();
	}

	function onRouteError(error) {
		if (entity)
			session.storage.deleteEntity(entity['eid'], function() {
				session.abort(new HttpError(502, error.message));
			});
		else
			session.abort(new HttpError(502, error.message));
	}
}

// TODO Handle child entities
exports.GET = function(session) {
	var type, route, entity;
	type = session.purl[session.purl.length-1].key;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.ptype.options['did']);

	function onRouteReady() {
		session.storage.selectEntities(type, session.ptype.options['did'], afterSelectEntities);
	}

	function afterSelectEntities(error, result) {
		var eids, i;
		if (error)
			return session.abort(error);
		if (result.length == 0)
			return session.abort(new HttpError(404, "entities not found"));
		eids = new Array();
		for (i=0; i<result.length; i++)
			eids.push(result[i]['eid']);
		route.method = "GET";
		route.path = "/"+type+"/"+eids.join(",");
		route.send(session.requestText, session.request.headers['content-type']);
	}

	function onRouteResponse() {
		// TODO Pass content type
		session.writeJSON(route.responseJson);
		session.end();
	}

	function onRouteError(error) {
		if (entity)
			session.storage.deleteEntity(entity['eid'], function() {
				session.abort(new HttpError(502, error.message));
			});
		else
			session.abort(new HttpError(502, error.message));
	}
}
