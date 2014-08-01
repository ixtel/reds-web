var Session = require("../shared/Session");
var NodeUserHook = require("./hooks/User");

module.exports = exports = function(request, response) {
	Session.call(this, request, response);
}

exports.prototype = Object.create(Session.prototype);

exports.prototype.Hooks = {
	'user': NodeUserHook
}
