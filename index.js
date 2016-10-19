var Botkit = require('botkit');

var token = process.env.SLACK_TOKEN;

var controller = Botkit.slackbot({
	json_file_store: 'notebook',
	// reconnect to Slack RTM when connection goes bad
	retry: Infinity,
	debug: false
});

// Assume single team mode if we have a SLACK_TOKEN
if (token) {
	console.log('Starting in single-team mode')
	controller.spawn({
		token: token,
		retry: Infinity
	}).startRTM(function (err, bot, payload) {
		if (err) {
			throw new Error(err)
		}

		console.log('Connected to Slack RTM')
	});
// Otherwise assume multi-team mode - setup beep boop resourcer connection
} else {
	console.log('Starting in Beep Boop multi-team mode');
	require('beepboop-botkit').start(controller, {debug: true});
}

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

controller.hears(['next'], ['direct_mention', 'direct_message'], function (bot, message) {

	controller.storage.teams.get(message.team, function (error, team_data) {
		if (team_data == undefined || team_data.release_queue.length == 0) {
			bot.reply(message, 'The queue is empty!')
		} else {
			console.log(JSON.stringify(team_data.release_queue));
			bot.reply(message, 'Next in the release queue is @' + team_data.release_queue[0])
		}

	})
});

controller.hears(['list'], ['direct_mention', 'direct_message'], function (bot, message) {

	controller.storage.teams.get(message.team, function (error, team_data) {

		if (team_data == undefined || team_data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			var list = team_data.release_queue.reduce(function (total, currentValue) {
				return total + '@' + currentValue + '\n';
			}, '');
			bot.reply(message, 'Current release queue in order:\n' + list)
		}
	})
});

controller.hears(['add'], ['direct_mention', 'direct_message'], function (bot, message) {

	bot.api.users.info({user: message.user}, function (error, response) {

		controller.storage.teams.get(message.team, function (error, team_data) {

			if (team_data == undefined) {
				team_data = {id: message.team, release_queue: []}
			}

			if (team_data.release_queue.indexOf(response.user.name) != -1) {
				bot.reply(message, '@' + response.user.name + ' you are already in the release queue')
			} else {
				team_data.release_queue.push(response.user.name);

				bot.reply(message, 'I\'m adding you @' + response.user.name + ' to the release queue')
			}

			controller.storage.teams.save(team_data, function (error) {
				if (error != undefined) {
					console.error(error)
				}
			})
		})
	})
});

controller.hears(['remove'], ['direct_mention', 'direct_message'], function (bot, message) {

	bot.api.users.info({user: message.user}, function (error, response) {

		controller.storage.teams.get(message.team, function (error, team_data) {
			if (team_data == undefined) {
				team_data = {id: message.team, release_queue: []}
			}

			var index = team_data.release_queue.indexOf(response.user.name);
			if (index < 0) {
				bot.reply(message, '@' + response.user.name + ' you are not in the release queue')
			} else {
				team_data.release_queue.splice(index, 1);

				bot.reply(message, 'I\'m removing you @' + response.user.name + ' from the release queue')
			}

			controller.storage.teams.save(team_data, function (error) {
				if (error != undefined) {
					console.error(error)
				}
			})
		})
	});
});

controller.hears(['skip'], ['direct_mention', 'direct_message'], function (bot, message) {

	bot.api.users.info({user: message.user}, function (error, response) {

		controller.storage.teams.get(message.team, function (error, team_data) {

			if (team_data == undefined) {
				team_data = {id: message.team, release_queue: []}
			}

			if (team_data.release_queue.length == 0) {
				bot.reply(message, 'The release queue is empty!')
			} else {
				var index = team_data.release_queue.indexOf(response.user.name);
				if (index < 0) {
					bot.reply(message, '@' + response.user.name + ' you are not in the release queue')
				} else if (index == 0 && team_data.release_queue.length == 1) {
					bot.reply(message, '@' + response.user.name + ' you are the only one in the release queue')
				} else {
					team_data.release_queue.splice(index, 1);
					team_data.release_queue.push(response.user.name);

					bot.reply(message, 'I\'m moving you @' + response.user.name + ' at the end of the release queue')
				}
			}

			controller.storage.teams.save(team_data, function (error) {
				if (error != undefined) {
					console.error(error)
				}
			})
		})
	})
});

controller.hears(['cleanup'], ['direct_mention', 'direct_message'], function (bot, message) {

	bot.reply(message, 'I\'m removing all people from the release queue')
});

controller.hears('A deployment has just been started!', ['message_received'], function (bot, message) {
	bot.api.users.info({user: message.user}, function (error, response) {
		bot.reply(message, 'Next in the release queue is: @' + response.user.name)
	})
});

controller.hears('.*', ['mention'], function (bot, message) {
	bot.reply(message, 'Sorry, I don\'t get that. Can you be more specific?')
});

controller.hears('help', ['direct_message', 'direct_mention'], function (bot, message) {
	var help = 'I will respond to the following messages: \n' +
		'`@' + bot.identity.name + ' hi` for a simple message.\n' +
		'`@' + bot.identity.name + ' add` to add yourself at the end of release queue.\n' +
		'`@' + bot.identity.name + ' remove` to remove yourself from the release queue.\n' +
		'`@' + bot.identity.name + ' cleanup` to remove all from the release queue.\n' +
		'`@' + bot.identity.name + ' next` for next in the release queue.\n' +
		'`@' + bot.identity.name + ' list` shows whole release queue.\n' +
		'`@' + bot.identity.name + ' help` to see this again.'
	bot.reply(message, help)
});

controller.hears('.*', ['direct_message', 'direct_mention'], function (bot, message) {
	bot.reply(message, 'Sorry <@' + message.user + '>, I don\'t understand. \n')
});
