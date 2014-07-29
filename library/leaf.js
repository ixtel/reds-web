(function(){
"use strict"; 

var Leaf = function(nodeUrl, cryptoFacility) {
	this.url = nodeUrl;
	this.crypto = cryptoFacility;
}

Leaf.prototype.signup = function(name, password, callback) {
	var id = 5;
	setTimeout(callback, 0, id);
}

Leaf.prototype.signin = function(name, password, callback) {
	var id = 23;
	setTimeout(callback, 0, id);
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? exports=Leaf : (self.reds=self.reds||new Object()).Leaf=Leaf;

})();
