var Botkit = require('botkit');
var os = require('os');

var token = process.env.SLACK_TOKEN;

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

	sayWhoIsNextInReleaseQueue(bot, message);
});

controller.hears(['queue'], ['direct_mention', 'direct_message'], function (bot, message) {

	controller.storage.teams.get(message.team, function (error, team_data) {

		if (team_data == undefined || team_data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			var list = team_data.release_queue.reduce(function (result, user) {
				return result + '<@' + user + '>\n';
			}, '');
			bot.reply(message, 'Current release queue in order:\n' + list)
		}
	})
});

controller.hears(['add'], ['direct_mention', 'direct_message'], function (bot, message) {

	var users_to_add = getMentionedUsers(bot, message);
	if (users_to_add == null) {
		users_to_add = [message.user];
	}

	controller.storage.teams.get(message.team, function (error, team_data) {

		if (team_data == undefined) {
			team_data = {id: message.team, release_queue: []}
		}

		for (idx in users_to_add) {
			var user_id = users_to_add[idx];

			if (team_data.release_queue.indexOf(user_id) != -1) {
				bot.reply(message, '<@' + user_id + '> is already in the release queue')
			} else {
				team_data.release_queue.push(user_id);

				bot.reply(message, 'I\'m adding <@' + user_id + '> to the end of the release queue')
			}
		}

		controller.storage.teams.save(team_data, function (error) {
			if (error != undefined) {
				console.error(error)
			}
		})
	})
});

controller.hears(['remove'], ['direct_mention', 'direct_message'], function (bot, message) {

	var users_to_remove = getMentionedUsers(bot, message);
	if (users_to_remove == null) {
		users_to_remove = [message.user];
	}

	controller.storage.teams.get(message.team, function (error, team_data) {
		if (team_data == undefined) {
			team_data = {id: message.team, release_queue: []}
		}

		for (idx in users_to_remove) {
			var user_id = users_to_remove[idx];

			var index = team_data.release_queue.indexOf(user_id);
			if (index < 0) {
				bot.reply(message, '<@' + user_id + '> is not in the release queue')
			} else {
				team_data.release_queue.splice(index, 1);

				bot.reply(message, 'I\'m removing <@' + user_id + '> from the release queue')
			}
		}

		controller.storage.teams.save(team_data, function (error) {
			if (error != undefined) {
				console.error(error)
			}
		})
	})
});

controller.hears(['cleanup'], ['direct_mention', 'direct_message'], function (bot, message) {

	bot.startConversation(message, function (error, convo) {

		convo.ask('Are you sure you want me to remove everyone from release queue?', [
			{
				pattern: bot.utterances.yes,
				callback: function (response, convo) {

					var team_data = {id: message.team, release_queue: []};
					controller.storage.teams.save(team_data, function (error) {
						if (error != undefined) {
							console.error(error)
						}
					});

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

	controller.storage.teams.get(message.team, function (error, team_data) {

		if (team_data == undefined) {
			team_data = {id: message.team, release_queue: []}
		}

		if (team_data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			var index = team_data.release_queue.indexOf(message.user);
			if (index < 0) {
				bot.reply(message, '<@' + message.user + '> you are not in the release queue')
			} else if (index == 0 && team_data.release_queue.length == 1) {
				bot.reply(message, '<@' + message.user + '> you are the only one in the release queue')
			} else {
				team_data.release_queue.splice(index, 1);
				team_data.release_queue.push(message.user);

				bot.reply(message, 'I\'m moving you <@' + message.user + '> at the end of the release queue')
			}
		}

		controller.storage.teams.save(team_data, function (error) {
			if (error != undefined) {
				console.error(error)
			}
		})
	})
});

controller.hears('A deployment has just been started!', ['ambient'], function (bot, message) {
	sayWhoIsNextInReleaseQueue(bot, message)
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

function sayWhoIsNextInReleaseQueue(bot, message) {
	controller.storage.teams.get(message.team, function (error, team_data) {
		if (team_data == undefined || team_data.release_queue.length == 0) {
			bot.reply(message, 'The release queue is empty!')
		} else {
			bot.reply(message, 'Next in the release queue is <@' + team_data.release_queue[0] + '>')
		}
	})
}

function getMentionedUsers(bot, message) {
	var botId = bot.identity.id;

	var mentioned_users;
	if (message != undefined) {
		mentioned_users = message.text.match(/<@\w+>/g)
	}

	if (mentioned_users instanceof Array) {
		mentioned_users = mentioned_users.map(function (value) {
			return value.match(/\w+/)[0]
		});

		var index = mentioned_users.indexOf(botId);
		if (index != -1) {
			mentioned_users.splice(index, 1);
		}
	}

	return mentioned_users;
}

function formatUptime(uptime) {
	var unit = 'second';
	if (uptime > 60) {
		uptime = uptime / 60;
		unit = 'minute';
	}
	if (uptime > 60) {
		uptime = uptime / 60;
		unit = 'hour';
	}
	if (uptime != 1) {
		unit = unit + 's';
	}

	uptime = uptime + ' ' + unit;
	return uptime;
}
