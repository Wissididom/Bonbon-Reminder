async function fileExists(path: string) {
  try {
    await Deno.lstat(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw err;
    }
  }
}

async function readConfigIfExists(filePath: string) {
  if (fileExists(filePath)) {
    return JSON.parse(await Deno.readTextFile(filePath));
  } else {
    return [];
  }
}

async function runMigration(cron: string) {
  const configObject = {
    channelIds: Deno.env.get("TWITCH_CHANNEL_IDS").split(","),
    cron: cron,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    senderId: Deno.env.get("SENDER_ID"),
    textMessage: Deno.env.get("TEXT_MESSAGE"),
  };

  const config = await readConfigIfExists(".config.json");

  config.push(configObject);

  Deno.writeTextFile(".config.json", JSON.stringify(config, null, 2) + "\n");
  console.log(JSON.stringify(config, null, 2) + "\n");

  const newEnv = `TWITCH_CLIENT_ID=${
    Deno.env.get("TWITCH_CLIENT_ID") ?? "[0-9a-z]"
  }\nTWITCH_CLIENT_SECRET=${
    Deno.env.get("TWITCH_CLIENT_SECRET") ?? "[0-9a-z]"
  }\n`;

  Deno.writeTextFile(".env", newEnv);
  console.log(newEnv);
}

const cron = prompt(
  "Please enter the cron expression you want to have it run as:\n",
);
await runMigration(cron);
