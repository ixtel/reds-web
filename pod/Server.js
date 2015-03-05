"use strict";

var Server = require("../shared/Server");
var PodSession = require("./Session");

module.exports = exports = function(config) {
    Server.call(this, config);
}

exports.prototype = Object.create(Server.prototype);

exports.prototype.listen = function(request, response) {
    Server.prototype.listen.call(this, request, response);
    var session = new PodSession(this.config, request, response);
    session.run();
}
