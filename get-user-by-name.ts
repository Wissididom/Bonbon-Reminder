import { checkEnv, getUser as getUserImpl } from "./utils.ts";

async function getUser(access_token: string, login: string | null) {
  checkEnv();
  return await getUserImpl(
    Deno.env.get("TWITCH_CLIENT_ID")!,
    access_token,
    login,
  );
}

async function getToken() {
  checkEnv();
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
    const token = {
      access_token: clientCredentialsJson.access_token,
      expires_in: clientCredentialsJson.expires_in,
      token_type: clientCredentialsJson.token_type,
    };
    return token;
  }
  return null;
}

async function handle() {
  checkEnv();
  const user = prompt("Enter the User whose Data you want to retrieve: ");
  if (!user) {
    // Probably cancelled prompt, I guess
    return;
  }
  const token = await getToken();
  if (!token) {
    console.log("token is null, failed to get token");
    return;
  }
  const userData = await getUser(token.access_token, user.toLowerCase());
  console.log(userData);
}

await handle();
