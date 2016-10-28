const Botkit = require('botkit');

const os = require('os');

const Queue = require('./src/queue');
const queue = new Queue(process.env.TRELLO_APP_KEY, process.env.TRELLO_TOKEN);

const Brain = require('./src/brain');
const brain = new Brain();


const controller = Botkit.slackbot({
	json_file_store: 'notebook',
	// reconnect to Slack RTM when connection goes bad
	retry: Infinity,
	debug: false
});

// Assume single team mode if we have a SLACK_TOKEN
console.log('Starting in single-team mode');
controller.spawn({
	token: process.env.SLACK_TOKEN,
	retry: Infinity
}).startRTM(function (error, bot, payload) {
	if (error) {
		throw new Error(error)
	}

	console.log('Connected to Slack RTM')
});

brain.learn();
controller.changeEars(function (patterns, message) {
	return brain.ears(patterns, message);
});

controller.on('bot_channel_join', function (bot, message) {
	bot.reply(message, "I'm here!");
});

controller.hears('hello', 'direct_mention', function (bot, message) {
	bot.reply(message, 'Hello.')
});

controller.hears('hello', 'direct_message', function (bot, message) {
	bot.reply(message, 'Hello.');
	bot.reply(message, 'It\'s nice to talk to you directly.');
});

controller.hears('next_in_queue', 'direct_mention,direct_message,mention', function (bot, message) {
	sayWhoIsNextInQueue(bot, message);
});

controller.hears('list_queue', 'direct_mention,direct_message', function (bot, message) {

	queue.load(function (error, data) {

		if (data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			var list = data.release_queue.map(function (user_name) {
				return user_name;
			}).join('\n');

			bot.reply(message, 'Current release queue in order:\n' + list)
		}
	});
});

controller.hears('add_to_queue', 'direct_mention,direct_message', function (bot, message) {

	queue.exists(message.user, function (error, data) {
		if (error) {

			console.log("Error while checking is user exists in release queue: " + error)
		} else if (data) {

			bot.reply(message, 'You are already in the release queue')
		} else {

			queue.add(message.user, function (error, data) {
				if (error) {
					bot.reply(message, "Sorry I was unable to add you to queue :(");
					console.log("Error while adding user to the release queue: " + error);
				} else {
					bot.reply(message, 'I\'m adding you to the end of the release queue')
				}
			});
		}
	})
});

controller.hears('remove_from_queue', 'direct_mention,direct_message', function (bot, message) {

	queue.exists(message.user, function (error, data) {
		if (error) {

			console.log("Error while checking is user exists in release queue: " + error)
		} else if (data && data.idCard) {

			queue.remove(data.idCard, function (error, data) {
				if (error) {
					bot.reply(message, "Sorry I was unable to remove you from queue :(");
					console.log("Error while removing user from the release queue: " + error);
				} else {
					bot.reply(message, 'I\'m removing you the the release queue')
				}
			});
		} else {

			bot.reply(message, 'but You are not in the release queue')
		}
	})
});

controller.hears('move_to_end_of_queue', 'direct_mention,direct_message', function (bot, message) {

	bot.reply(message, 'Not implemented yet!')
});

controller.hears('deploy_started', 'ambient', function (bot, message) {
	sayWhoIsNextInQueue(bot, message)
});

controller.hears('deploy_finished', 'ambient', function (bot, message) {
	bot.reply(message, ":boom: Another one bites the dust! :trainonfire:")
});

controller.hears('identify_yourself', 'direct_message,direct_mention,mention', function (bot, message) {

	var hostname = os.hostname();
	var uptime = formatUptime(process.uptime());

	bot.reply(message,
		':robot_face: I am a bot named Sheriff... Release Sheriff. ' +
		'I have been running for ' + uptime + ' on ' + hostname + '. I\'m about two ticks away from becoming self-aware; Do not piss me off!');
});

controller.hears('thanks', 'direct_message,direct_mention', function (bot, message) {
	bot.reply(message, "Your welcome mate!")
});

controller.hears('shot_the_sheriff', 'direct_message,direct_mention', function (bot, message) {
	bot.reply(message, "hmm... no idea?");
	bot.reply(message, "http://x3.cdn03.imgwykop.pl/c3201142/comment_oio2V9eM94ap7rsTc3eIv92CBehPZj1e.gif");
});

controller.hears('default_message', 'direct_message,direct_mention', function (bot, message) {
	bot.reply(message, 'Sorry ' + message.user + ', I don\'t understand. Maybe try to be more specific?')
});

function sayWhoIsNextInQueue(bot, message) {
	queue.load(function (error, data) {
		if (data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			bot.reply(message, 'Next in the release queue is ' + data.release_queue[0] + '')
		}
	});
}

function formatUptime(uptime) {

	var date = new Date(uptime * 1000);
	var hh = date.getUTCHours();
	var mm = date.getUTCMinutes();
	var ss = date.getSeconds();

	var result = [];
	if (hh > 0) {
		result.push(hh + ' hr');
	}
	if (mm > 0) {
		result.push(mm + ' min');
	}
	if (ss > 0) {
		result.push(ss + ' sec');
	}

	return result.join(' ');
}
