import fs from "node:fs";
import process from "node:process";
import readline from "node:readline";

function readConfigIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  } else {
    return [];
  }
}

function runMigration(cron) {
  const configObject = {
    channelIds: process.env.TWITCH_CHANNEL_IDS.split(","),
    cron: cron,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    senderId: process.env.SENDER_ID,
    textMessage: process.env.TEXT_MESSAGE,
  };

  const config = readConfigIfExists(".config.json");

  config.push(configObject);

  fs.writeFileSync(".config.json", JSON.stringify(config, null, 2) + "\n");
  console.log(JSON.stringify(config, null, 2) + "\n");

  const newEnv = `TWITCH_CLIENT_ID=${
    process.env.TWITCH_CLIENT_ID ?? "[0-9a-z]"
  }\nTWITCH_CLIENT_SECRET=${process.env.TWITCH_CLIENT_SECRET ?? "[0-9a-z]"}\n`;

  fs.writeFileSync(".env", newEnv);
  console.log(newEnv);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "Please enter the cron expression you want to have it run as:\n",
  (cron) => {
    rl.close();
    runMigration(cron);
  },
);
