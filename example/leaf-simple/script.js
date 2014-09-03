"use strict"

var cryptoFacility = reds.crypto.sjcl||reds.crypto.cryptojs;
var leaf = new reds.LeafClient("http://node.reds-web.dev", cryptoFacility);

function convertElementsToObject(elements) {
	var result = new Object();
	for (var i=0; i<elements.length; i++)
		if (elements[i].name.length > 0)
			result[elements[i].name] = elements[i].value;
	return result;
}

function testCryptoFacility() {
	console.log(cryptoFacility.name);
	var start = Date.now();
	console.log("keypair1");
	var keypair1 = cryptoFacility.generateKeypair();
	console.log(Date.now()-start);
	console.log("keypair2");
	var keypair2 = cryptoFacility.generateKeypair();
	console.log(Date.now()-start);
	console.log("combined1");
	var combined1 = cryptoFacility.combineKeypair(keypair1.privateKey, keypair2.publicKey);
	console.log(Date.now()-start);
	console.log("combined2");
	var combined2 = cryptoFacility.combineKeypair(keypair2.privateKey, keypair1.publicKey);
	console.log(Date.now()-start);
	console.log(keypair1.privateKey);
	console.log(keypair1.publicKey);
	console.log(keypair2.privateKey);
	console.log(keypair2.publicKey);
	console.log(combined1);
	console.log(combined2);

	start = Date.now();
	console.log("key");
	var key = cryptoFacility.generateKey("foobar");
	console.log(Date.now()-start);
	console.log("vector");
	var vector = cryptoFacility.generateKey();
	console.log(Date.now()-start);
	console.log(vector);
	console.log(key);

	start = Date.now();
	console.log("cdata");
	var cdata = cryptoFacility.encryptData("mydata", key, vector);
	console.log(Date.now()-start);
	console.log("data");
	var data = cryptoFacility.decryptData(cdata, key, vector);
	console.log(Date.now()-start);
	console.log(cdata);
	console.log(data);
	
	start = Date.now();
	console.log("hmac");
	var hmac = cryptoFacility.generateHmac("mydata", "foo");	
	console.log(Date.now()-start);
	console.log("shash");
	var shash = cryptoFacility.generateSecureHash("mydata", "bar");
	console.log(Date.now()-start);
	console.log(hmac);
	console.log(shash);

	start = Date.now();
	console.log("ts1");
	var ts1 = cryptoFacility.generateTimestamp();
	console.log(Date.now()-start);
	console.log("ts2");
	var ts2 = cryptoFacility.generateTimestamp();
	console.log(Date.now()-start);
	console.log("cp1");
	var cp1 = cryptoFacility.compareTimestamps(ts1, ts2);
	console.log(Date.now()-start);
	console.log("cp2");
	var cp2 = cryptoFacility.compareTimestamps(ts2, ts1);
	console.log(Date.now()-start);
	console.log(ts1);
	console.log(ts2);
	console.log(cp1);
	console.log(cp2);
}

// INFO Account actions

function signup(name, password, confirmation) {
	console.log("signup: "+Array.prototype.slice.apply(arguments));
	// if ((name.length == 0) || (password.length == 0))
	// 	return alert("Name and password must not be empty!")
	// if (password != confirmation)
	// 	return alert("Password and confirmation mismatch!");
	leaf.signup(name, password, afterSignup);

	function afterSignup(response) {
		showAccount(response['id']);
	}
}

function signin(name, password) {
	console.log("signin: "+Array.prototype.slice.apply(arguments));
	leaf.signin(name, password, afterSignin)

	function afterSignin(response) {
		showAccount(response['id']);
	}
}

function deleteAccount(account) {
	console.log("signout: "+Array.prototype.slice.apply(arguments));
	document.getElementById("Account").style['display'] = "";
}

function showAccount(account) {
	console.log("showContact: "+Array.prototype.slice.apply(arguments));
	document.getElementById("Account").style['display'] = "block";
	document.getElementById("AccountId").value = account;
	loadContactList(account);
}

function addContact(account, fields) {
	console.log("addContact: "+Array.prototype.slice.apply(arguments));
}

function loadContactList(account, filter) {
	console.log("loadContactList: "+Array.prototype.slice.apply(arguments));
}

// INFO Contact actions

function showContact(contact) {
	console.log("showContact: "+Array.prototype.slice.apply(arguments));
	document.getElementById("Contact").style['display'] = "block";
	document.getElementById("ContactId").value = contact;
	loadAddressList(contact);
}

function saveContact(fields) {
	console.log("saveContact: "+Array.prototype.slice.apply(arguments));
}

function deleteContact(contact) {
	console.log("deleteContact: "+Array.prototype.slice.apply(arguments));
	document.getElementById("Address").style['display'] = "";
	document.getElementById("Contact").style['display'] = "";
}

function addAddress(contact, fields) {
	console.log("addAddress: "+Array.prototype.slice.apply(arguments));
}

function loadAddressList(contact, filter) {
	console.log("loadAddressList: "+Array.prototype.slice.apply(arguments));
}

// INFO Address actions

function showAddress(address) {
	console.log("showAddress: "+Array.prototype.slice.apply(arguments));
	document.getElementById("Address").style['display'] = "block";
	document.getElementById("AddressId").value = address;
}

function saveAddress(fields) {
	console.log("saveAddress: "+Array.prototype.slice.apply(arguments));
}

function deleteAddress(address) {
	console.log("deleteAddress: "+Array.prototype.slice.apply(arguments));
	document.getElementById("Address").style['display'] = "";
}

// INFO Page initialization

function init() {
	console.log(reds);

	document.getElementById("TestCryptoFacility").addEventListener("submit", function(evt) {
		evt.preventDefault();
		testCryptoFacility();
	}, false);

	document.getElementById("SignUp").addEventListener("submit", function(evt) {
		evt.preventDefault();
		signup(this.elements['name'].value, this.elements['password'].value, this.elements['confirmation'].value);
	}, false);

	document.getElementById("SignIn").addEventListener("submit", function(evt) {
		evt.preventDefault();
		signin(this.elements['name'].value, this.elements['password'].value);
	}, false);

	document.getElementById("DeleteAccount").addEventListener("click", function(evt) {
		evt.preventDefault();
		deleteAccount(this.form.elements['id'].value);
	}, false);

	document.getElementById("AddContact").addEventListener("submit", function(evt) {
		evt.preventDefault();
		addContact(document.getElementById("AccountId").value, this.elements);
	}, false);

	document.getElementById("ContactList").addEventListener("submit", function(evt) {
		evt.preventDefault();
		showContact(this.elements['list'].value);
	}, false);

	document.getElementById("ReloadContactList").addEventListener("click", function(evt) {
		evt.preventDefault();
		loadContactList(document.getElementById("AccountId").value, this.form.elements['filter'].value);
	}, false);

	document.getElementById("EditContact").addEventListener("submit", function(evt) {
		evt.preventDefault();
		saveContact(convertElementsToObject(this.elements));
	}, false);

	document.getElementById("DeleteContact").addEventListener("click", function(evt) {
		evt.preventDefault();
		deleteContact(this.form.elements['id'].value);
	}, false);

	document.getElementById("AddressList").addEventListener("submit", function(evt) {
		evt.preventDefault();
		showAddress(this.elements['list'].value);
	}, false);

	document.getElementById("AddAddress").addEventListener("submit", function(evt) {
		evt.preventDefault();
		addAddress(document.getElementById("ContactId").value, this.elements);
	}, false);

	document.getElementById("ReloadAddressList").addEventListener("click", function(evt) {
		evt.preventDefault();
		loadAddressList(document.getElementById("ContactId").value, this.form.elements['filter'].value);
	}, false);

	document.getElementById("EditAddress").addEventListener("submit", function(evt) {
		evt.preventDefault();
		saveAddress(convertElementsToObject(this.elements));
	}, false);

	document.getElementById("DeleteAddress").addEventListener("click", function(evt) {
		evt.preventDefault();
		deleteAddress(this.form.elements['id'].value);
	}, false);
}

window.addEventListener("load", init, false);
