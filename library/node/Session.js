var Session = require("../shared/Session");

module.exports = exports = function(config, request, response) {
	Session.call(this, config, request, response);
}

exports.prototype = Object.create(Session.prototype);

exports.prototype.HookHandlers = {
	'user': require("./hooks/user")
}

exports.prototype.StorageFacilities = {
	'pg': require("../shared/storage/PostgreSQL")
}
