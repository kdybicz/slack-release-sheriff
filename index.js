var Botkit = require('botkit');
var os = require('os');

var token = process.env.SLACK_TOKEN;

var storage_key = 'queue';

var controller = Botkit.slackbot({
	json_file_store: 'notebook',
	// reconnect to Slack RTM when connection goes bad
	retry: Infinity,
	debug: false
});

// Assume single team mode if we have a SLACK_TOKEN
if (token) {
	console.log('Starting in single-team mode');
	controller.spawn({
		token: token,
		retry: Infinity
	}).startRTM(function (error, bot, payload) {
		if (error) {
			throw new Error(error)
		}

		console.log('Connected to Slack RTM')
	});
// Otherwise assume multi-team mode - setup beep boop resourcer connection
} else {
	console.log('Starting in Beep Boop multi-team mode');
	require('beepboop-botkit').start(controller, {debug: true});
}

initializeStorage(controller);

controller.on('bot_channel_join', function (bot, message) {
	bot.reply(message, "I'm here!");
});

controller.hears(['hello', 'hi'], ['direct_mention'], function (bot, message) {
	bot.reply(message, 'Hello.')
});

controller.hears(['hello', 'hi'], ['direct_message'], function (bot, message) {
	bot.reply(message, 'Hello.');
	bot.reply(message, 'It\'s nice to talk to you directly.');
});

controller.hears(['next'], ['direct_mention', 'direct_message', 'mention'], function (bot, message) {
	sayWhoIsNextInQueue(bot, message);
});

controller.hears(['queue', 'list'], ['direct_mention', 'direct_message'], function (bot, message) {

	loadQueue(function (error, data) {

		if (data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			var list = data.release_queue.map(function (user_id) {
				return '<@' + user_id + '>';
			}).join('\n');

			bot.reply(message, 'Current release queue in order:\n' + list)
		}
	});
});

controller.hears(['add'], ['direct_mention', 'direct_message'], function (bot, message) {

	var users_to_add = getMentionedUsers(bot, message);
	if (!users_to_add) {
		users_to_add = [message.user];
	}

	loadQueue(function (error, data) {

		for (idx in users_to_add) {
			var user_id = users_to_add[idx];

			if (data.release_queue.indexOf(user_id) != -1) {
				bot.reply(message, '<@' + user_id + '> is already in the release queue')
			} else {
				data.release_queue.push(user_id);

				bot.reply(message, 'I\'m adding <@' + user_id + '> to the end of the release queue')
			}
		}

		saveQueue(data);
	});
});

controller.hears(['remove'], ['direct_mention', 'direct_message'], function (bot, message) {

	var users_to_remove = getMentionedUsers(bot, message);
	if (!users_to_remove) {
		users_to_remove = [message.user];
	}

	loadQueue(function (error, data) {

		for (idx in users_to_remove) {
			var user_id = users_to_remove[idx];

			var index = data.release_queue.indexOf(user_id);
			if (index < 0) {
				bot.reply(message, '<@' + user_id + '> is not in the release queue')
			} else {
				data.release_queue.splice(index, 1);

				bot.reply(message, 'I\'m removing <@' + user_id + '> from the release queue')
			}
		}

		saveQueue(data);
	});
});

controller.hears(['cleanup'], ['direct_mention', 'direct_message'], function (bot, message) {

	bot.startConversation(message, function (error, convo) {

		convo.ask('Are you sure you want me to remove everyone from release queue?', [
			{
				pattern: bot.utterances.yes,
				callback: function (response, convo) {
					saveQueue({id: storage_key, release_queue: []});

					convo.say('Done!');
					convo.next();
				}
			},
			{
				pattern: bot.utterances.no,
				callback: function (response, convo) {
					convo.say('*Phew!*');
					convo.next();
				}
			},
			{
				default: true,
				callback: function (reply, convo) {
					convo.repeat();
					convo.next();
				}
			}
		]);
	});
});

controller.hears(['skip'], ['direct_mention', 'direct_message'], function (bot, message) {

	loadQueue(function (error, data) {

		if (data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			var index = data.release_queue.indexOf(message.user);
			if (index < 0) {
				bot.reply(message, '<@' + message.user + '> you are not in the release queue')
			} else if (index == 0 && data.release_queue.length == 1) {
				bot.reply(message, '<@' + message.user + '> you are the only one in the release queue')
			} else {
				data.release_queue.splice(index, 1);
				data.release_queue.push(message.user);

				bot.reply(message, 'I\'m moving you <@' + message.user + '> at the end of the release queue')
			}
		}

		saveQueue(data);
	});
});

controller.hears('A deployment has just been started!', ['ambient'], function (bot, message) {
	sayWhoIsNextInQueue(bot, message)
});

controller.hears('The deployment is complete, send out the release notes!', ['ambient'], function (bot, message) {
	bot.reply(message, ":boom: Another one bites the dust! :trainonfire:")
});

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'], 'direct_message,direct_mention,mention', function (bot, message) {

	var hostname = os.hostname();
	var uptime = formatUptime(process.uptime());

	bot.reply(message, ':robot_face: I am a bot named <@' + bot.identity.name + '>. I have been running for ' + uptime + ' on ' + hostname + '.');
});

controller.hears('help', ['direct_message', 'direct_mention'], function (bot, message) {
	var help = 'I will respond to the following messages: \n' +
		'`@' + bot.identity.name + ' hi` for a simple message.\n' +
		'`@' + bot.identity.name + ' add` to add yourself at the end of release queue.\n' +
		'`@' + bot.identity.name + ' remove` to remove yourself from the release queue.\n' +
		'`@' + bot.identity.name + ' cleanup` to remove all from the release queue.\n' +
		'`@' + bot.identity.name + ' next` for next in the release queue.\n' +
		'`@' + bot.identity.name + ' queue` shows whole release queue.\n' +
		'`@' + bot.identity.name + ' help` to see this again.';
	bot.reply(message, help)
});

controller.hears('.*', ['mention'], function (bot, message) {
	bot.reply(message, 'I don\'t like when people are talking behind my back :(')
});

controller.hears('.*', ['direct_message', 'direct_mention'], function (bot, message) {
	bot.reply(message, 'Sorry <@' + message.user + '>, I don\'t understand. Try: `@' + bot.identity.name + ' help`')
});

function sayWhoIsNextInQueue(bot, message) {
	loadQueue(function (error, data) {
		if (data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			bot.reply(message, 'Next in the release queue is <@' + data.release_queue[0] + '>')
		}
	});
}

function getMentionedUsers(bot, message) {
	if (message) {
		var mentioned_users = message.text.match(/<@\w+>/g);
		if (mentioned_users instanceof Array) {
			return mentioned_users.map(function (value) {
				return value.match(/\w+/)[0];
			}).filter(function (element) {
				return element != bot.identity.id;
			});
		}
	}

	return null;
}

function initializeStorage() {
	console.log('Initialising storage');

	loadQueue(function (error, data) {

		if (!data) {
			saveQueue({id: storage_key, release_queue: []});
		}
	});
}

function saveQueue(data) {
	controller.storage.teams.save(data, function (error) {
		if (error) {
			throw new Error(error)
		}
	});
}

function loadQueue(func) {
	controller.storage.teams.get(storage_key, func);
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
