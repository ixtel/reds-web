"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

function parseSelection(selection) {
	var result, type, tstr, estr, i;
	result = {
		'types': new Object(),
		'path': null
	};
	for (i=0; i<selection.length; i++) {
		if (!result.types[selection[i]['type']]) {
			result.types[selection[i]['type']] = new Array(selection[i]);
			result.types[selection[i]['type']].estr = selection[i]['eid'];
		}
		else {
			result.types[selection[i]['type']].push(selection[i]['eid']);
			result.types[selection[i]['type']].estr += ","+selection[i]['eid'];
		}
	}
	for (type in result.types) {
		tstr = (tstr ? tstr+"," : "/")+type;
		estr = (estr ? estr+";" : "/")+result.types[type].estr;
		delete result.types[type].estr;
	}
	result.path = tstr+estr;
	return result;
}

exports.POST = function(session) {
	var route, eid;
	if (session.selector.last.value) {
		session.storage.registerEntity(session.selector, session.type.options['did'], afterRegisterEntity);
	}
	else {
		route = new Route(session.crypto, session.storage);
		route.addListener("error", onRouteError);
		route.addListener("ready", onRouteReady);
		route.addListener("response", onRouteResponse);
		route.resolve(session.type.options['did']);
	}

	function onRouteReady() {
		session.storage.reserveEntity(session.selector, session.type.options['did'], afterReserveEntity);
	}

	function afterReserveEntity(error, result) {
		if (error)
			return session.abort(error);
		eid = result;
		route.method = "POST";
		route.path = "/"+session.selector.last.key+"/"+eid;
		route.write(session.requestText, session.request.headers['content-type']);
		route.requestHeaders['authorization'] = session.request.headers['authorization'];
		route.send();
	}

	function onRouteResponse() {
		var rselector;
		// NOTE This JSON dance is neccasary to create a real clone.
		rselector = JSON.parse(JSON.stringify(session.selector));
		rselector.last = rselector[rselector.length-1];
		rselector.last.value = eid;
		session.storage.registerEntity(rselector, session.type.options['did'], afterRegisterEntity);
	}

	function onRouteError(error) {
		session.abort(error);
	}

	function afterRegisterEntity(error, result) {
		if (error)
			return session.abort(error);
		// TODO Support multiple MIME types
		if (route) {
			session.write(route.responseText, route.responseHeaders['content-type']);
			session.response.setHeader("Authorization", route.responseHeaders['authorization']);
		}
		else {
			session.writeJson(result);
		}
		session.end();
	}
}

exports.HEAD = function(session) {
	session.storage.selectEntities(session.selector, session.type.options['did'], afterSelectEntities);

	function afterSelectEntities(error, result) {
		var dids, i;
		if (error)
			return session.abort(error);
		if (!result) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value != "*")
				return session.abort(new HttpError(404, "entities not found"));
			else
				return session.end(204);
		}
		dids = new Object();
		for (i=0; i<result.length; i++)
			dids[result[i]['did']] = true;
		session.write(undefined, "application/x.reds.domain;did="+Object.keys(dids).join(","));
		session.end(result.length?200:204);
	}
}

exports.GET = function(session) {
	var route, selection;
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
		if (!result) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value != "*")
				return session.abort(new HttpError(404, "entities not found"));
			else
				return session.end(204);
		}
		selection = parseSelection(result);
		route.method = "GET";
		route.path = selection.path;
		route.write(session.requestText, session.request.headers['content-type']);
		route.requestHeaders['authorization'] = session.request.headers['authorization'];
		route.send();
	}

	function onRouteResponse() {
		// TODO Support multiple MIME types
		//session.writeJson(selection.types);
		session.write(route.responseText, route.responseHeaders['content-type']);
		session.response.setHeader("Authorization", route.responseHeaders['authorization']);
		session.end();
	}

	function onRouteError(error) {
		session.abort(error);
	}
}

exports.PUT = function(session) {
	var route, selection;
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
		if (!result) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value != "*")
				return session.abort(new HttpError(404, "entities not found"));
			else
				return session.end(204);
		}
		selection = parseSelection(result);
		route.method = "PUT";
		route.path = selection.path;
		route.write(session.requestText, session.request.headers['content-type']);
		route.requestHeaders['authorization'] = session.request.headers['authorization'];
		route.send();
	}

	function onRouteResponse() {
		// TODO Support multiple MIME types
		//session.writeJson(selection.types);
		session.write(route.responseText, route.responseHeaders['content-type']);
		session.response.setHeader("Authorization", route.responseHeaders['authorization']);
		session.response.setHeader("X-REDS-Authorization", route.responseHeaders['authorization']);
		session.end();
	}

	function onRouteError(error) {
		session.abort(error);
	}
}

exports.DELETE = function(session) {
	var route, selection;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		session.storage.selectCascade(session.selector, session.type.options['did'], afterSelectCascade);
	}

	function afterSelectCascade(error, result) {
		var types, eids, i, t;
		if (error)
			return session.abort(error);
		if (!result) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value != "*")
				return session.abort(new HttpError(404, "entities not found"));
			else
				return session.end(204);
		}
		selection = parseSelection(result);
		route.method = "DELETE";
		route.path = selection.path;
		route.write(session.requestText, session.request.headers['content-type']);
		route.requestHeaders['authorization'] = session.request.headers['authorization'];
		route.send();
	}

	function onRouteResponse() {
		session.storage.unregisterEntities(session.selector, session.type.options['did'], afterUnregisterEntities);
	}

	function onRouteError(error) {
		session.abort(error);
	}

	function afterUnregisterEntities(error, result) {
		if (error)
			return session.abort(error);
		// TODO Support multiple MIME types
		//session.write(route.responseText, route.responseHeaders['content-type']);
		//session.response.setHeader("Authorization", route.responseHeaders['authorization']);
		session.writeJson(selection.types);
		session.end();
	}
}
