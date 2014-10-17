"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.POST = function(session) {
	var route, entity;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		session.storage.registerEntity(session.selector, session.type.options['did'], afterRegisterEntity);
	}

	function afterRegisterEntity(error, result) {
		if (error)
			return session.abort(error);
		route.method = "POST";
		route.path = "/"+session.selector.last.key+"/"+result['eid'];
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		session.write(route.responseText, route.responseType);
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

exports.HEAD = function(session) {
	session.storage.selectEntities(session.selector, session.type.options['did'], afterSelectEntities);

	function afterSelectEntities(error, result) {
		var dids, i;
		if (error)
			return session.abort(error);
		if (result.length == 0)
			return session.abort(new HttpError(404, "entities not found"));
		dids = new Array();
		for (i=0; i<result.length; i++)
			dids.push(result[i]['did']);
		session.write(undefined, "application/x.reds.domain;did="+dids.join(","));
		session.end();
	}
}

exports.GET = function(session) {
	var route, entity;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		session.storage.selectEntities(session.selector, session.type.options['did'], afterSelectEntities);
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
		route.path = "/"+session.selector.last.key+"/"+eids.join(",");
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		session.write(route.responseText, route.responseType);
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
