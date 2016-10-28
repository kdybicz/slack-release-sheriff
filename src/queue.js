const Trello = require("node-trello");

module.exports = Queue;

function Queue(app_key, user_token) {
	this.trello = new Trello(app_key, user_token);
	this.list_id = '54edc21af7905fb3cc1e4ad9';
	this.list_name = 'Master Merge Lock';
}

Queue.prototype.load = function (callback) {
	this.trello.get("/1/lists/" + this.list_id + "/cards", function (err, data) {
		if (err) {
			callback(err, null)
		} else {
			var output = {release_queue: []};
			data.forEach(function (entry) {
				output.release_queue.push(entry.name)
			});
			callback(null, output)
		}
	});
};

Queue.prototype.add = function (username, callback) {
	var options = {
		'idList': this.list_id,
		'name': username,
		'pos': 'bottom',
		'due': null
	};
	this.trello.post("/1/cards", options, function (err, data) {
		if (err) {
			callback(err, null)
		} else {
			callback(null, true)
		}
	});
};

Queue.prototype.exists = function (username, callback) {
	var options = {
		'query': 'is:open list:"' + this.list_name + '" ' + username,
		'card_fields': 'name,idList',
		'card_list': true
	};
	this.trello.get("/1/search", options, function (err, data) {
		if (err) {
			callback(err, null)
		} else if (data && data.cards && data.cards.length > 0 && data.cards[0].name == username) {
			callback(null, {'idCard': data.cards[0].id})
		} else {
			callback(null, null)
		}
	});
};

Queue.prototype.remove = function (id, callback) {
	this.trello.del("/1/cards/" + id, function (err, data) {
		if (err) {
			callback(err, false)
		} else {
			callback(null, true)
		}
	});
};