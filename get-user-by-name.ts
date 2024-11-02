import { getUser as getUserImpl } from "./utils.ts";

let token = {
  access_token: null,
  expires_in: null,
  token_type: null,
};

async function getUser(login) {
  return await getUserImpl(
    Deno.env.get("TWITCH_CLIENT_ID"),
    token.access_token,
    login,
  );
}

async function getToken() {
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
    return token;
  }
}

const user = prompt("Enter the User whose Data you want to retrieve: ");
await getToken();
const userData = await getUser(user.toLowerCase());
console.log(userData);
