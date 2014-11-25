var PodServer = require("../../pod/Server.js");
var config = require("./config.json");

var server = new PodServer(config);
server.run();
