"use strict";

var HttpError = require("../../../shared/HttpError");
var Route = require("../../Route");

function passThrough(session) {
    var route;
    route = new Route(session.crypto, session.storage);
    route.addListener("error", onRouteError);
    route.addListener("ready", onRouteReady);
    route.addListener("response", onRouteResponse);
    route.resolve(session.selector[0].value);

    function onRouteReady() {
        route.method = session.request.method;
        route.path = session.request.url;
        route.write(session.requestText, session.request.headers['content-type']);
        route.requestHeaders['authorization'] = session.request.headers['authorization'];
        route.send();
    }

    function onRouteResponse() {
        session.write(route.responseText, route.responseHeaders['content-type']);
        session.response.setHeader("Authorization", route.responseHeaders['authorization']);
        session.end();
    }

    function onRouteError(error) {
        session.abort(error);
    }
}

exports.POST = passThrough;

