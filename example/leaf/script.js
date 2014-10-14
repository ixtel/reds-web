"use strict"

var leaf = new reds.leaf.Client({
	'url': "http://node.reds-web.dev",
	'crypto': ["sjcl-1", "cryptojs-1"]
});

leaf.addEventListener("error", function(evt) {
	evt.preventDefault();
	alert(evt.detail);
});

function convertElementsToObject(elements) {
	var result = new Object();
	for (var i=0; i<elements.length; i++)
		if (elements[i].name.length > 0)
			result[elements[i].name] = elements[i].value;
	return result;
}

function testCryptoFacility() {
	function log(text) {
		document.forms["TestCryptoFacility"].elements['output'].value += text;
	}

	document.forms["TestCryptoFacility"].elements['output'].value = "";
	log("name: "+leaf.crypto.name+"\n\n");

	log("hmac = generateHmac(\"mydata\", \"foo\")");
	start = Date.now();
	var hmac = leaf.crypto.generateHmac("mydata", "foo");
	time = Date.now()-start;
	log(" ("+time+" ms)\nhmac = "+hmac+"\n\n");

	log("hash1 = generateSecureHash(\"mydata\", \"foo\", true)");
	start = Date.now();
	var hash1 = leaf.crypto.generateSecureHash("mydata", "bar", true);
	time = Date.now()-start;
	log(" ("+time+" ms)\nhash1 = "+hash1+"\n");
	log("hash2 = generateSecureHash(\"mydata\", \"foo\")");
	start = Date.now();
	var hash2 = leaf.crypto.generateSecureHash("mydata", "bar");
	time = Date.now()-start;
	log(" ("+time+" ms, might be cached)\nhash2 = "+hash2+"\n\n");

	log("ts1 = generateTimestamp()");
	start = Date.now();
	var ts1 = leaf.crypto.generateTimestamp();
	time = Date.now()-start;
	log(" ("+time+" ms)\nts1 = "+ts1+"\n");
	log("ts2 = generateTimestamp()");
	start = Date.now();
	var ts2 = leaf.crypto.generateTimestamp();
	time = Date.now()-start;
	log(" ("+time+" ms)\nts2 = "+ts2+"\n\n");

	log("cp1 = compareTimestamps(ts1, ts2)");
	start = Date.now();
	var cp1 = leaf.crypto.compareTimestamps(ts1, ts2);
	time = Date.now()-start;
	log(" ("+time+" ms)\ncp1 = "+cp1+"\n");
	log("cp2 = compareTimestamps(ts1, ts2)");
	start = Date.now();
	var cp2 = leaf.crypto.compareTimestamps(ts2, ts1);
	time = Date.now()-start;
	log(" ("+time+" ms)\ncp2 = "+cp2+"\n\n");

	log("key = generateKey()");
	start = Date.now();
	var key = leaf.crypto.generateKey();
	time = Date.now()-start;
	log(" ("+time+" ms)\nkey = "+key+"\n");
	log("vec = generateKey()");
	start = Date.now();
	var vec = leaf.crypto.generateKey();
	time = Date.now()-start;
	log(" ("+time+" ms)\nvec = "+vec+"\n\n");

	log("pair1 = generateKeypair()");
	var start = Date.now();
	var pair1 = leaf.crypto.generateKeypair();
	var time = Date.now()-start;
	log(" ("+time+" ms)\npair1.privateKey = "+pair1.privateKey+"\n");
	log("pair1.publicKey = "+pair1.publicKey+"\n");
	log("pair2 = generateKeypair()");
	start = Date.now();
	var pair2 = leaf.crypto.generateKeypair();
	time = Date.now()-start;
	log(" ("+time+" ms)\npair2.privateKey = "+pair2.privateKey+"\n");
	log("pair2.publicKey = "+pair2.publicKey+"\n\n");

	log("combined1 = combineKeypair(pair1.privateKey, pair2.publicKey)");
	start = Date.now();
	var combined1 = leaf.crypto.combineKeypair(pair1.privateKey, pair2.publicKey);
	time = Date.now()-start;
	log(" ("+time+" ms)\ncombined1 = "+combined1+"\n");
	log("combined2 = combineKeypair(pair2.privateKey, pair1.publicKey)");
	start = Date.now();
	var combined2 = leaf.crypto.combineKeypair(pair2.privateKey, pair1.publicKey);
	time = Date.now()-start;
	log(" ("+time+" ms)\ncombined2 = "+combined2+"\n\n");

	log("scombined1 = combineKeypair(pair2.privateKey, pair1.publicKey, \"secret\")");
	start = Date.now();
	var scombined1 = leaf.crypto.combineKeypair(pair2.privateKey, pair1.publicKey, "secret");
	time = Date.now()-start;
	log(" ("+time+" ms)\nscombined1 = "+scombined1+"\n");
	log("scombined2 = combineKeypair(pair2.privateKey, pair1.publicKey, \"wrongsecret\")");
	start = Date.now();
	var scombined2 = leaf.crypto.combineKeypair(pair2.privateKey, pair1.publicKey, "wrongsecret");
	time = Date.now()-start;
	log(" ("+time+" ms)\nscombined2 = "+scombined2+"\n\n");

	log("cdata1 = encryptData(\"mydata\", key, vec)");
	start = Date.now();
	var cdata1 = leaf.crypto.encryptData("mydata", key, vec);
	time = Date.now()-start;
	log(" ("+time+" ms)\ncdata1 = "+cdata1+"\n");
	log("cdata2 = encryptData(\"mydata\", combined1, combined2)");
	start = Date.now();
	var cdata2 = leaf.crypto.encryptData("mydata", combined1, combined2);
	time = Date.now()-start;
	log(" ("+time+" ms)\ncdata2 = "+cdata2+"\n\n");

	log("data1 = decryptData(cdata1, key, vec)");
	var data1 = leaf.crypto.decryptData(cdata1, key, vec);
	time = Date.now()-start;
	log(" ("+time+" ms)\ndata1 = "+data1+"\n");
	log("data2 = decryptData(cdata2, combined1, combined2)");
	var data2 = leaf.crypto.decryptData(cdata2, combined1, combined2);
	time = Date.now()-start;
	log(" ("+time+" ms)\ndata2 = "+data2+"\n");
}

// INFO Account actions

function signup(name, password, confirmation) {
	if ((name.length == 0) || (password.length == 0))
		return alert("Name and password must not be empty!")
	if (password != confirmation)
		return alert("Password and confirmation mismatch!");
	leaf.createAccount(name, password, afterSignup);

	function afterSignup(response) {
		document.getElementById("SignUp").reset();
		showAccount(response['id']);
	}
}

function signin(name, password) {
	leaf.signin(name, password, afterSignin)

	function afterSignin(response) {
		document.getElementById("SignIn").reset();
		showAccount(response['id']);
	}
}

function signout() {
	leaf.signout(afterSignout)

	function afterSignout(response) {
		document.getElementById("Account").style['display'] = "";
	}
}

function deleteAccount() {
	leaf.deleteAccount(afterDeleteAccount);

	function afterDeleteAccount(response) {
		document.getElementById("Account").style['display'] = "";
	}
}

function showAccount(account) {
	document.getElementById("Account").style['display'] = "block";
	document.getElementById("AccountId").value = account;
	loadContactList(account);
}

function addContact(name, url, password) {
	leaf.createEntity("/contact", {
		'text': name
	}, {
		'url': url,
		'password': password
	}, afterCreateEntity);

	function afterCreateEntity(response) {
		var option = document.createElement("option");
		option.setAttribute("value", response['eid']);
		option.appendChild(document.createTextNode(response['text']));
		document.getElementById("ContactList").elements['list'].appendChild(option);
	}
}

function loadContactList(filter) {
}

// INFO Contact actions

function showContact(contact) {
	document.getElementById("Contact").style['display'] = "block";
	document.getElementById("ContactId").value = contact;
	loadAddressList(contact);
}

function saveContact(fields) {
}

function deleteContact(contact) {
	document.getElementById("Address").style['display'] = "";
	document.getElementById("Contact").style['display'] = "";
}

function addAddress(contact, fields) {
}

function loadAddressList(contact, filter) {
}

// INFO Address actions

function showAddress(address) {
	document.getElementById("Address").style['display'] = "block";
	document.getElementById("AddressId").value = address;
}

function saveAddress(fields) {
}

function deleteAddress(address) {
	document.getElementById("Address").style['display'] = "";
}

// INFO Page initialization

function init() {
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

	document.getElementById("SignOut").addEventListener("click", function(evt) {
		evt.preventDefault();
		signout();
	}, false);

	document.getElementById("AddContact").addEventListener("submit", function(evt) {
		evt.preventDefault();
		addContact(this.elements['name'].value, this.elements['pod'].value, this.elements['password'].value);
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
