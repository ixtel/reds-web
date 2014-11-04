"use strict"

var leaf = new reds.leaf.Client({
	'url': "http://node.reds-web.dev",
	'crypto': ["sjcl-1", "cryptojs-1"]
});

leaf.addEventListener("error", function(evt) {
	evt.preventDefault();
	if (evt.detail.length)
		alert(evt.detail.join("\n"));
	else
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
		showAccount(response['aid']);
	}
}

function signin(name, password) {
	leaf.signin(name, password, afterSignin)

	function afterSignin(response) {
		document.getElementById("SignIn").reset();
		document.getElementById("SignUpSignIn").style['display'] = "hidden";
		showAccount(response['aid']);
	}
}

function signout() {
	leaf.signout(afterSignout)

	function afterSignout(response) {
		hideAccount();
	}
}

function deleteAccount() {
	leaf.deleteAccount(afterDeleteAccount);

	function afterDeleteAccount(response) {
		hideAccount();
	}
}

function showAccount(account) {
	document.getElementById("Account").style['display'] = "block";
	document.getElementById("Contacts").style['display'] = "block";
	document.getElementById("SignUpSignIn").style['display'] = "hidden";
	document.getElementById("AccountId").value = account;
	loadContactList();
}

function hideAccount(account) {
	hideContact();
	document.getElementById("Account").style['display'] = "";
	document.getElementById("SignUpSignIn").style['display'] = "";
	document.getElementById("EditAccount").elements['id'].value = "";
	clearContactList();
}

function addContact(name, url, password) {
	leaf.createEntityAndDomain("/contact", {
		'name': name
	}, url, password, afterCreateEntityAndDomain);

	function afterCreateEntityAndDomain(response) {
		var option = document.createElement("option");
		option.setAttribute("value", response.entity['eid']);
		option.appendChild(document.createTextNode(response.entity['name']));
		document.getElementById("ContactList").elements['list'].appendChild(option);
		document.getElementById("AddContact").reset();
	}
}

function loadContactList(filter) {
	clearContactList();
	leaf.readEntities("/contact/*", afterReadEntities.bind(this));

	function afterReadEntities(response) {
		var contactList, i;
		contactList = document.getElementById("ContactList");
		for (i=0; i<response.length; i++) {
			var option = document.createElement("option");
			option.setAttribute("value", response[i]['eid']);
			option.appendChild(document.createTextNode(response[i]['name']));
			contactList.elements['list'].appendChild(option);
		}
	}
}

function clearContactList() {
	var contactList;
	contactList = document.getElementById("ContactList");
	contactList.elements['filter'].value = "";
	while (contactList.elements['list'].lastChild)
		contactList.elements['list'].removeChild(contactList.elements['list'].lastChild);
}

// INFO Contact actions

function showContact(contact) {
	leaf.readEntities("/contact/"+contact, afterReadEntities.bind(this));

	function afterReadEntities(response) {
		document.getElementById("Contact").style['display'] = "block";
		document.getElementById("EditContact").elements['id'].value = response[0]['eid'];
		document.getElementById("EditContact").elements['name'].value = response[0]['name'];
		loadAddressList(contact);
	}
}

function hideContact(contact) {
	hideAddress();
	document.getElementById("Contact").style['display'] = "";
	document.getElementById("EditContact").elements['id'].value = "";
	document.getElementById("EditContact").elements['name'].value = "";
	clearAddressList();
}

function saveContact(contact, name) {
	leaf.updateEntities("/contact/"+contact, [
		{'eid':parseInt(contact), 'name': name}
	], afterUpdateEntities.bind(this));

	function afterUpdateEntities(response) {
		document.getElementById("Contact").style['display'] = "block";
		document.getElementById("EditContact").elements['id'].value = response[0]['eid'];
		document.getElementById("EditContact").elements['name'].value = response[0]['name'];
	}
}

function deleteContact(contact) {
	leaf.deleteEntitiesAndDomains("/contact/"+contact, afterDeleteEntitiesAndDomains);

	function afterDeleteEntitiesAndDomains(response) {
		console.log(response);
		hideContact();
	}
}

function addAddress(contact, street, city) {
	leaf.createEntity("/contact/"+contact+"/address", {
		'street': street,
		'city': city
	}, afterCreateEntity);

	function afterCreateEntity(response) {
		var option = document.createElement("option");
		option.setAttribute("value", response['eid']);
		option.appendChild(document.createTextNode(response['street']+", "+response['city']));
		document.getElementById("AddressList").elements['list'].appendChild(option);
		document.getElementById("AddAddress").reset();
	}
}

function loadAddressList(contact, filter) {
	clearAddressList();
	leaf.readEntities("/contact/"+contact+"/address/*", afterReadEntities.bind(this));

	function afterReadEntities(response) {
		var addressList, i;
		addressList = document.getElementById("AddressList");
		for (i=0; i<response.length; i++) {
			var option = document.createElement("option");
			option.setAttribute("value", response[i]['eid']);
			option.appendChild(document.createTextNode(response[i]['street']+", "+response[i]['city']));
			addressList.elements['list'].appendChild(option);
		}
	}
}

function clearAddressList(contact) {
	var addressList;
	addressList = document.getElementById("AddressList");
	addressList.elements['filter'].value = "";
	while (addressList.elements['list'].lastChild)
		addressList.elements['list'].removeChild(addressList.elements['list'].lastChild);
}

// INFO Address actions

function showAddress(address) {
	leaf.readEntities("/address/"+address, afterReadEntities.bind(this));

	function afterReadEntities(response) {
		document.getElementById("Address").style['display'] = "block";
		document.getElementById("EditAddress").elements['id'].value = response[0]['eid'];
		document.getElementById("EditAddress").elements['street'].value = response[0]['street'];
		document.getElementById("EditAddress").elements['city'].value = response[0]['city'];
	}
}

function hideAddress(address) {
	document.getElementById("Address").style['display'] = "";
	document.getElementById("EditAddress").elements['id'].value = "";
	document.getElementById("EditAddress").elements['street'].value = "";
	document.getElementById("EditAddress").elements['city'].value = "";
}

function saveAddress(address, street, city) {
	leaf.updateEntities("/address/"+address, [
		{'eid':parseInt(address), 'street': street, 'city': city}
	], null, afterUpdateEntities);

	function afterUpdateEntities(response) {
		document.getElementById("Address").style['display'] = "block";
		document.getElementById("EditAddress").elements['id'].value = response[0]['eid'];
		document.getElementById("EditAddress").elements['street'].value = response[0]['street'];
		document.getElementById("EditAddress").elements['city'].value = response[0]['city'];
	}
}

function deleteAddress(address) {
	leaf.deleteEntities("/address/"+address, afterDeleteEntities);

	function afterDeleteEntities(response) {
		hideAddress();
	}
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
		clearContactList();
		loadContactList(this.form.elements['filter'].value);
	}, false);

	document.getElementById("EditContact").addEventListener("submit", function(evt) {
		evt.preventDefault();
		saveContact(this.elements['id'].value, this.elements['name'].value);
	}, false);

	document.getElementById("DeleteContact").addEventListener("click", function(evt) {
		evt.preventDefault();
		deleteContact(this.form.elements['id'].value);
	}, false);

	document.getElementById("HideContact").addEventListener("click", function(evt) {
		evt.preventDefault();
		hideContact();
	}, false);

	document.getElementById("AddressList").addEventListener("submit", function(evt) {
		evt.preventDefault();
		showAddress(this.elements['list'].value);
	}, false);

	document.getElementById("AddAddress").addEventListener("submit", function(evt) {
		evt.preventDefault();
		addAddress(document.getElementById("ContactId").value, this.elements['street'].value, this.elements['city'].value);
	}, false);

	document.getElementById("ReloadAddressList").addEventListener("click", function(evt) {
		evt.preventDefault();
		loadAddressList(document.getElementById("ContactId").value, this.form.elements['filter'].value);
	}, false);

	document.getElementById("EditAddress").addEventListener("submit", function(evt) {
		evt.preventDefault();
		saveAddress(this.elements['id'].value, this.elements['street'].value, this.elements['city'].value);
	}, false);

	document.getElementById("DeleteAddress").addEventListener("click", function(evt) {
		evt.preventDefault();
		deleteAddress(this.form.elements['id'].value);
	}, false);

	document.getElementById("HideAddress").addEventListener("click", function(evt) {
		evt.preventDefault();
		hideAddress();
	}, false);
}

window.addEventListener("load", init, false);
