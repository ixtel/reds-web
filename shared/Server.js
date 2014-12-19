"use strict";

var cluster = require("cluster");
var http = require("http");
var os = require("os");

module.exports = exports = function(config, Session) {
    this.config = config;
    this.httpd = null;
    this.Session = Session;

    if (this.config.workers == "cores")
        this.config.workers = os.cpus().length;
}

exports.prototype.run = function() {
    if (cluster.isMaster)
        this.setup();
    else
        this.connect();
}

exports.prototype.setup = function() {
    console.log("MASTER "+process.pid); // DEBUG
    for (var i = 0; i < this.config.workers; i++)
        cluster.fork();
}

exports.prototype.connect = function() {
    console.log("WORKER "+process.pid+" "+this.config.host+" "+this.config.port); // DEBUG
    this.httpd = http.createServer();
    this.httpd.listen(this.config.port, this.config.host);
    this.httpd.addListener("request", this.listen.bind(this));
}

exports.prototype.listen = function(request, response) {
    console.log("LISTEN "+process.pid+" "+request.method+" "+request.url); // DEBUG
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Expires", "-1");
    var session = new this.Session(this.config, request, response);
    session.run();
}
