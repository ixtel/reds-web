"use strict";

var cluster = require("cluster");
var http = require("http");
var os = require("os");

module.exports = exports = function(config) {
    this.config = config;
    this.httpd = null;

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
    console.info("M "+process.pid+" starting workers"); // DEBUG
    for (var i = 0; i < this.config.workers; i++)
        cluster.fork();
}

exports.prototype.connect = function() {
    console.info("W "+process.pid+" starting http server"); // DEBUG
    this.httpd = http.createServer();
    this.httpd.listen(this.config.port, this.config.host);
    this.httpd.addListener("listening", onListening.bind(this));
    this.httpd.addListener("request", this.listen.bind(this));

    function onListening() {
        var addr = this.httpd.address();
        console.info("W "+process.pid+" listening at "+addr.address+":"+addr.port);
        process.setgid(this.config.group);
        console.info("W "+process.pid+" gid is now "+process.getgid());
        process.setuid(this.config.user);
        console.info("W "+process.pid+" uid is now "+process.getuid());
        if (process.getuid() == 0)
            console.warn("W "+process.pid+" process runs with root privileges!")
    }
}

exports.prototype.listen = function(request, response) {
    console.log("W "+process.pid+" "+request.method+" "+request.url); // DEBUG
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Expires", "-1");
}
