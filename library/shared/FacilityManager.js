module.exports = exports = function(name) {
	this.facilities = new Object();
}

exports.prototype.addFacility = function(facility) {
	this.facilities[facility.prototype.name] = facility;
}

exports.prototype.addFactoryToObject = function(factory, obj) {
	var facilities = this.facilities;
	obj[factory] = function(name, arg) {
		if (facilities[name])
			return new facilities[name](arg);
		else
			return Object.getPrototypeOf(this)[factory](name);
	}
}

exports.prototype.addFinalFactoryToObject = function(factory, obj) {
	var facilities = this.facilities;
	obj[factory] = function(name, arg) {
		if (facilities[name])
			return new facilities[name](arg);
		else
			throw new Error("unknown facility "+name);
	}
}
