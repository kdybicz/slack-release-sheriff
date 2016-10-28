# slack-release-sheriff

## Overview
Release Sheriff is a Slack bot trying to help keep a track on single feature releases.

## Usage

### Trello credentials

#### Getting Trello app key
	https://trello.com/app-key

#### Getting Trello user token
	https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&name=Release%20Sherif&key=<YOUR_APP_KEY>

### Run locally
	npm install
	SLACK_TOKEN=<YOUR_SLACK_TOKEN> TRELLO_APP_KEY=<YOUR_APP_KEY> TRELLO_USER_TOKEN=<USER_TOKEN> npm start

Things are looking good if the console prints something like:

    ** API CALL: https://slack.com/api/rtm.start
    ** BOT ID:  witty  ...attempting to connect to RTM!
    ** API CALL: https://slack.com/api/chat.postMessage

### Run locally in Docker
	docker build -t starter-node .`
	docker run --rm -it -e SLACK_TOKEN=<YOUR_SLACK_TOKEN> -e TRELLO_APP_KEY=<YOUR_APP_KEY> -e TRELLO_USER_TOKEN=<USER_TOKEN> starter-node

## Acknowledgements

This code uses the :
+ [botkit](https://github.com/howdyai/botkit) npm module.
+ [NLP](https://github.com/NaturalNode/natural) npm module.
+ [node-trello](https://github.com/adunkman/node-trello) npm module.

## License

See the [LICENSE](LICENSE.md) file (MIT).
