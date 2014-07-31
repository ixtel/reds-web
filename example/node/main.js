var NodeServer = require("../../library/node/Server.js");
var config = require("./config.json");

var server = new NodeServer(config);
server.run();
