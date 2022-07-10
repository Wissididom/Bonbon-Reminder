require('dotenv').config();
const express = require('express');
//const fs = require('fs').promises;
const fs = require('fs');
const tmi = require('tmi.js');

let tokens = {
	access_token: 'N/A',
	refresh_token: 'N/A'
}

function validate(openBrowser = true) {
	return new Promise((resolve, reject) => {
		fetch('https://id.twitch.tv/oauth2/validate', {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${tokens.access_token}`
			}
		}).then(async (res) => {
			if (res.status > 199 && res.status < 300)
				res = await res.json();
			if (res.status) {
				if (res.status == 401) {
					console.log('Trying to refresh with the refresh token');
					await fetch(`https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(tokens.refresh_token)}&client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}`, {
						method: 'POST',
						headers: {
							'Client-ID': process.env.TWITCH_CLIENT_ID,
							'Authorization': `Bearer ${tokens.access_token}`
						}
					}).then(async (res) => {
						if (res.status > 199 && res.status < 300) {
							res = await res.json();
							tokens = res;
							fs.writeFileSync('./.tokens.json', JSON.stringify(res));
							console.log(`Tokens saved! - ${JSON.stringify(res)}`);
							resolve('Tokens successfully refreshed!');
						} else {
							res = await res.json();
							console.log(JSON.stringify(res));
							console.log('Failed to refresh the token! Try to reauthenticate!');
							console.log(`Status: ${res.status}`);
							console.log(`Error-Message: ${res.message}`);
							console.log(`Open the following Website to authenticate: https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=chat%3Aread%20chat%3Aedit%20channel%3Amoderate`);
							if (openBrowser)
								require('open')(`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=channel%3Aread%3Apolls%20channel%3Aread%3Apredictions%20channel%3Amanage%3Apolls%20channel%3Amanage%3Apredictions`);
						}
					}).catch(err => {
						console.log('Failed to refresh the token! Try to reauthenticate!');
						console.error(err);
						console.log(`Open the following Website to authenticate: https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=chat%3Aread%20chat%3Aedit%20channel%3Amoderate`);
						if (openBrowser)
							require('open')(`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=chat%3Aread%20chat%3Aedit%20channel%3Amoderate`);
					});
				} else {
					console.log(`Status: ${res.status}`);
					console.log(`Error-Message: ${res.message}`);
					reject("Tokens couldn't be refreshed!");
				}
			} else {
				console.log('Validating...');
				console.log(`Client-ID: ${res.client_id}`);
				console.log(`Login-Name: ${res.login}`);
				console.log(`Scopes: ${res.scopes.join(', ')}`);
				console.log(`User-ID: ${res.user_id}`);
				console.log(`Expires in: ${res.expires_in} seconds`);
				resolve('Successfully validated!');
			}
		}).catch(err => {
			reject(`Validation failed! - ${err}`);
		});
	});
}

function main() {
	validate().then(() => {
		const client = new tmi.Client({
			options: {
				debug: true
			},
			identity: {
				username: process.env.TWITCH_BOT_USERNAME,
				password: `oauth:${tokens.access_token}`
			},
			channels: process.env.TWITCH_CHANNELS.split(',')
		});
		client.connect().then(async () => {
			let channels = process.env.TWITCH_CHANNELS.split(',');
			for (let i = 0; i < channels.length; i++) {
				await client.say(channels[i], process.env.TEXT_MESSAGE);
			}
			await client.disconnect();
			process.exit();
		}).catch(console.error);
	}).catch((err) => {
		console.log(`Failed to validate token, refresh token or authenticate! - ${err}`);
		process.kill(process.pid, 'SIGTERM');
	});
}

const server = express();
server.all('/', async (req, res) => {
	const authObj = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&code=${req.query.code}&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}`, {
		method: 'POST'
	}).then(res => res.json()).catch(err => console.error);
	if (authObj.access_token && authObj.refresh_token) {
		tokens = authObj;
		fs.writeFileSync('./.tokens.json', JSON.stringify(authObj));
		res.send('<html>Tokens saved!</html>');
		console.log('Tokens saved!');
		main();
	} else {
		res.send("Couldn't get the access token!");
		console.log("Couldn't get the access token!");
	}
});

server.listen(parseInt(process.env.LOCAL_SERVER_PORT), () => {
	console.log('Express Server ready!');
});

if (fs.existsSync('./.tokens.json')) {
	tokens = require('./.tokens.json');
	if (tokens.access_token && tokens.refresh_token) {
		main();
	} else {
		console.log(`Open the following Website to authenticate: https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=chat%3Aread%20chat%3Aedit%20channel%3Amoderate`);
		require('open')(`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=chat%3Aread%20chat%3Aedit%20channel%3Amoderate`);
	}
} else {
	console.log(`Open the following Website to authenticate: https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=chat%3Aread%20chat%3Aedit%20channel%3Amoderate`);
	require('open')(`https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A${process.env.LOCAL_SERVER_PORT}&response_type=code&scope=chat%3Aread%20chat%3Aedit%20channel%3Amoderate`);
}
