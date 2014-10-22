"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.POST = function(session) {
	var route, entity;
	if (session.selector.last.value) {
		session.storage.linkEntities(session.selector, afterLinkEntities);
	}
	else {
		route = new Route(session.crypto, session.storage);
		route.addListener("error", onRouteError);
		route.addListener("ready", onRouteReady);
		route.addListener("response", onRouteResponse);
		route.resolve(session.type.options['did']);
	}

	function onRouteReady() {
		session.storage.registerEntity(session.selector, session.type.options['did'], afterRegisterEntity);
	}

	function afterRegisterEntity(error, result) {
		if (error)
			return onError(error);
		entity = result;
		route.method = "POST";
		route.path = "/"+session.selector.last.key+"/"+entity['eid'];
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		var rselector;
		session.write(route.responseText, route.responseType);
		if (session.selector.length == 1)
			return session.end();
		// NOTE This JSON dance is neccasary to create a real clone.
		rselector = JSON.parse(JSON.stringify(session.selector));
		rselector.last = rselector[rselector.length-1];
		rselector.last.value = route.responseJson['eid'];
		session.storage.linkEntities(rselector, afterLinkEntities);
	}

	function onRouteError(error) {
		onError(new HttpError(502, error.message));
	}

	function afterLinkEntities(error, result) {
		if (error)
			return onError(error);
		// NOTE As long as we don't support mime multipart responses,
		//      the linking result can only be sent when the routing
		//      response hasn't been written already.
		if (!route)
			session.writeJSON(result);
		session.end();
	}

	function onError(error) {
		if (entity)
			session.storage.unregisterEntity(entity['eid'], function() {
				session.abort(error);
			});
		else
			session.abort(error);
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
	var route;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		session.storage.selectEntities(session.selector, session.type.options['did'], afterSelectEntities);
	}

	function afterSelectEntities(error, result) {
		var types, eids, i, type;
		if (error)
			return session.abort(error);
		if (result.length == 0) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value)
				return session.abort(new HttpError(404, "entities not found"));
			else
				// TODO The 204 case should be handled by session end
				return session.abort(new HttpError(204, "empty response"));
		}
		types = new Object();
		for (i=0; i<result.length; i++) {
			if (!types[result[i]['type']])
				types[result[i]['type']] = result[i]['eid'];
			else
				types[result[i]['type']] += ","+result[i]['eid'];
		}
		eids = new Array();
		for (type in types) {
			eids.push(types[type]);
		}
		route.method = "GET";
		route.path = "/"+Object.keys(types).join(",")+"/"+eids.join(";");
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		session.write(route.responseText, route.responseType);
		session.end();
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}
}

exports.PUT = function(session) {
	var route;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		session.storage.selectEntities(session.selector, session.type.options['did'], afterSelectEntities);
	}

	function afterSelectEntities(error, result) {
		var types, eids, i, type;
		if (error)
			return session.abort(error);
		if (result.length == 0) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value)
				return session.abort(new HttpError(404, "entities not found"));
			else
				// TODO The 204 case should be handled by session end
				return session.abort(new HttpError(204, "empty response"));
		}
		types = new Object();
		for (i=0; i<result.length; i++) {
			if (!types[result[i]['type']])
				types[result[i]['type']] = result[i]['eid'];
			else
				types[result[i]['type']] += ","+result[i]['eid'];
		}
		eids = new Array();
		for (type in types) {
			eids.push(types[type]);
		}
		route.method = "PUT";
		route.path = "/"+Object.keys(types).join(",")+"/"+eids.join(";");
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		session.write(route.responseText, route.responseType);
		session.end();
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}
}
