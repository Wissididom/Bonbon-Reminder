import "dotenv/config";
import * as readline from "readline";
import { getUser as getUserImpl } from "./utils.js";

let token = {
  access_token: null,
  expires_in: null,
  token_type: null,
};

async function getUser(login) {
  return getUserImpl(process.env.TWITCH_CLIENT_ID, token.access_token, login);
}

async function getToken() {
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
    return token;
  }
}

const readlineInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
readlineInterface.question(
  "Enter the User whose Data you want to retrieve: ",
  async (user) => {
    await getToken();
    let userData = await getUser(user.toLowerCase());
    console.log(userData);
    readlineInterface.close();
  },
);
