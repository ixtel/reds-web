(function(){
"use strict"; 

var Leaf = function(url, cryptoFacility) {
	this.url = url;
	this.crypto = cryptoFacility;
}

Leaf.prototype.signup = function(name, password, callback) {
	var xhr = new XMLHttpRequest();
	xhr.addEventListener("load", onLoad, false);
	xhr.open("POST", this.url+"/user/foobar", true);
	xhr.send("user data");

	function onLoad() {
		callback(xhr.responseText);
	}
}

Leaf.prototype.signin = function(name, password, callback) {
	var xhr = new XMLHttpRequest();
	xhr.addEventListener("load", onLoad, false);
	xhr.open("GET", this.url+"/user/foobar", true);
	xhr.send();

	function onLoad() {
		callback(xhr.responseText);
	}
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? exports=Leaf : (self.reds=self.reds||new Object()).Leaf=Leaf;

})();
