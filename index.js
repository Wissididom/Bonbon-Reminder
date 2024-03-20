import "dotenv/config";
import { getUser as getUserImpl } from "./utils.js";

let token = {
  access_token: null,
  expires_in: null,
  token_type: null,
};

// https://dev.twitch.tv/docs/api/reference/#send-chat-message
async function sendMessage(broadcasterId, senderId, message) {
  let data = {
    broadcaster_id: broadcasterId,
    sender_id: senderId,
    message,
  };
  return await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }).then(async (res) => {
    // 200 OK = Successfully sent the message
    // 400 Bad Request
    // 401 Unauthorized
    // 403 Forbidden = The sender is not permitted to send chat messages to the broadcaster’s chat room.
    // 422 = The message is too large
    console.log(
      `${res.status}: ${senderId} -> ${broadcasterId}\n${JSON.stringify(await res.json(), null, 2)}`,
    );
    if (res.status >= 200 && res.status < 300) {
      return true;
    } else {
      return false;
    }
  });
}

async function getUser(login) {
  return getUserImpl(process.env.TWITCH_CLIENT_ID, tokens.access_token, login);
}

// https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow
let clientCredentials = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
  {
    method: "POST",
  },
);
if (clientCredentials.status >= 200 && clientCredentials.status < 300) {
  let clientCredentialsJson = await clientCredentials.json();
  token = {
    access_token: clientCredentialsJson.access_token,
    expires_in: clientCredentialsJson.expires_in,
    token_type: clientCredentialsJson.token_type,
  };
}
let channels = process.env.TWITCH_CHANNELS.split(",");
for (let i = 0; i < channels.length; i++) {
  let user = await getUser(channels[i].toLowerCase());
  await sendMessage(user.id, process.env.SENDER_ID, process.env.TEXT_MESSAGE);
}
