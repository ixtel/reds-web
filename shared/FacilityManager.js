(function(){
"use strict";

var FacilityManager = function(name) {
    this.facilities = new Object();
}

FacilityManager.prototype.addFacility = function(facility) {
    this.facilities[facility.prototype.name] = facility;
}

FacilityManager.prototype.addFactoryToObject = function(factory, obj) {
    var facilities = this.facilities;
    obj[factory] = function(name, arg) {
        if (facilities[name])
            return new facilities[name](arg);
        else if (Object.getPrototypeOf(this)[factory])
            return Object.getPrototypeOf(this)[factory](name);
        else
            throw new Error("unknown facility "+name);
    }
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=FacilityManager : (self.reds=self.reds||new Object()).FacilityManager = FacilityManager;

})();
