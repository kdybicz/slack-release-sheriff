var NLP = require('natural');
var fs = require('fs');

module.exports = Brain;

function Brain() {
	this.classifier = new NLP.LogisticRegressionClassifier();
	this.minConfidence = 0.5;
}

Brain.prototype.ears = function (patterns, message) {

	var guesses = this.classifier.getClassifications(message.text.toLowerCase());
	var guess = guesses.reduce(toMaxValue);

	var label = guess.value >= this.minConfidence ? guess.label : 'default_message';

	var matches = false;
	patterns.forEach(function (pattern) {
		if (pattern == label) {
			matches = true;
		}
	});

	return matches;
};

Brain.prototype.learn = function () {
	var expressionsText = fs.readFileSync(__dirname + '/../data/memory.json').toString();
	var expressions = JSON.parse(expressionsText);

	Object.keys(expressions).forEach(function (label) {
		var phrases = expressions[label];

		phrases.forEach(function (phrase) {
			console.log('Ingesting example for ' + label + ': ' + phrase);
			this.classifier.addDocument(phrase.toLowerCase(), label);
		}.bind(this));
	}.bind(this));

	this.classifier.train();

	console.log('OMG! I\'m so smart now!');
};

function toMaxValue(x, y) {
	return x && x.value > y.value ? x : y;
}