import { schedule } from "node-cron";

let token = {
  access_token: null,
  expires_in: null,
  token_type: null,
};

// https://dev.twitch.tv/docs/api/reference/#send-chat-message
async function sendMessage(
  broadcasterId: string,
  senderId: string,
  message: string,
) {
  const data = {
    broadcaster_id: broadcasterId,
    sender_id: senderId,
    message,
    for_source_only: false,
  };
  return await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Client-ID": Deno.env.get("TWITCH_CLIENT_ID")!,
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
      `${res.status}: ${senderId} -> ${broadcasterId}\n${
        JSON.stringify(await res.json(), null, 2)
      }`,
    );
    if (res.status >= 200 && res.status < 300) {
      return true;
    } else {
      return false;
    }
  });
}

async function handleReminder(
  channelIds: string[],
  senderId: string,
  textMessage: string,
) {
  // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow
  const clientCredentials = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${
      Deno.env.get("TWITCH_CLIENT_ID")
    }&client_secret=${
      Deno.env.get("TWITCH_CLIENT_SECRET")
    }&grant_type=client_credentials`,
    {
      method: "POST",
    },
  );
  if (clientCredentials.status >= 200 && clientCredentials.status < 300) {
    const clientCredentialsJson = await clientCredentials.json();
    token = {
      access_token: clientCredentialsJson.access_token,
      expires_in: clientCredentialsJson.expires_in,
      token_type: clientCredentialsJson.token_type,
    };
  }
  for (let i = 0; i < channelIds.length; i++) {
    await sendMessage(channelIds[i], senderId, textMessage);
  }
}

const config = JSON.parse(await Deno.readTextFile(".config.json"));

for (const reminder of config) {
  console.log("Schedule job: " + JSON.stringify(reminder));
  schedule(
    reminder.cron,
    async () => {
      await handleReminder(
        reminder.channelIds,
        reminder.senderId,
        reminder.textMessage,
      );
    },
    {
      scheduled: true,
      timezone: reminder.timezone,
    },
  );
}
