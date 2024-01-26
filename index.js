import "dotenv/config";
import * as fs from "fs";

const SCOPES = encodeURIComponent(["user:write:chat"].join(" "));

let tokens = {
  access_token: null,
  refresh_token: null,
  device_code: null,
  user_code: null,
  verification_uri: null,
  user_id: null,
};

async function sendMessage(broadcasterId, senderId, message, firstTry = true) {
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
    console.log(`${res.status}: ${JSON.stringify(await res.json())}`);
    if (res.status >= 200 && res.status < 300) {
      return true;
    } else {
      if (firstTry) {
        if (await refresh()) {
          return await sendMessage(broadcasterId, senderId, message, false);
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
  });
}

async function getUser(login) {
  if (login) {
    return (
      await fetch(`https://api.twitch.tv/helix/users?login=${login}`, {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }).then((res) => res.json())
    ).data[0];
  } else {
    return (
      await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }).then((res) => res.json())
    ).data[0];
  }
}

async function refresh() {
  console.log("Refreshing tokens...");
  let refreshResult = await fetch(
    `https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(tokens.refresh_token)}&client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}`,
    {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${tokens.access_token}`,
      },
    },
  );
  let refreshJson = await refreshResult.json();
  if (refreshResult.status >= 200 && refreshResult.status < 300) {
    // Successfully refreshed
    tokens.access_token = refreshJson.access_token;
    tokens.refresh_token = refreshJson.refresh_token;
    fs.writeFileSync("./.tokens.json", JSON.stringify(tokens));
    console.log("Successfully refreshed tokens!");
    return true;
  } else {
    // Refreshing failed
    console.log(`Failed refreshing tokens: ${JSON.stringify(refreshJson)}`);
    return false;
  }
}

async function validate() {
  return await fetch("https://id.twitch.tv/oauth2/validate", {
    method: "GET",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${tokens.access_token}`,
    },
  }).then(async (res) => {
    if (res.status) {
      if (res.status == 401) {
        return await refresh();
      } else if (res.status >= 200 && res.status < 300) {
        console.log("Successfully validated tokens!");
        return true;
      } else {
        console.error(
          `Unhandled validation error: ${JSON.stringify(await res.json())}`,
        );
        return false;
      }
    } else {
      console.error(
        `Unhandled network error! res.status is undefined or null! ${res}`,
      );
      return false;
    }
  });
}

async function authenticated() {
  let channels = process.env.TWITCH_CHANNELS.split(",");
  for (let i = 0; i < channels.length; i++) {
    await sendMessage(
      (await getUser(channels[i].toLowerCase())).id,
      tokens.user_id,
      process.env.TEXT_MESSAGE,
    );
  }
}

if (fs.existsSync("./.tokens.json")) {
  tokens = JSON.parse(fs.readFileSync("./.tokens.json"));
  let validated = await validate();
  if (validated) {
    await authenticated();
  }
} else {
  let dcf = await fetch(
    `https://id.twitch.tv/oauth2/device?client_id=${process.env.TWITCH_CLIENT_ID}&scopes=${SCOPES}`,
    {
      method: "POST",
    },
  );
  if (dcf.status >= 200 && dcf.status < 300) {
    // Successfully got DCF data
    let dcfJson = await dcf.json();
    tokens.device_code = dcfJson.device_code;
    tokens.user_code = dcfJson.user_code;
    tokens.verification_uri = dcfJson.verification_uri;
    console.log(
      `Open ${tokens.verification_uri} in a browser and enter ${tokens.user_code} there!`,
    );
  }
  let dcfInterval = setInterval(async () => {
    let tokenResponse = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&scopes=${encodeURIComponent(SCOPES)}&device_code=${tokens.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
      {
        method: "POST",
      },
    );
    if (tokenResponse.status == 400) return; // Probably authorization pending
    if (tokenResponse.status >= 200 && tokenResponse.status < 300) {
      // Successfully got token
      let tokenJson = await tokenResponse.json();
      tokens.access_token = tokenJson.access_token;
      tokens.refresh_token = tokenJson.refresh_token;
      let user = await getUser();
      tokens.user_id = user.id;
      fs.writeFileSync("./.tokens.json", JSON.stringify(tokens), {
        encoding: "utf8",
      });
      clearInterval(dcfInterval);
      console.log(
        `Got Device Code Flow Tokens for ${user.display_name} (${user.login})`,
      );
      await authenticated();
    }
  }, 1000);
}
