export function checkEnv() {
  if (hasEnv()) return;
  throw new Deno.errors.InvalidData(
    "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET env vars are required",
  );
}

export function hasEnv() {
  return Deno.env.has("TWITCH_CLIENT_ID") &&
    Deno.env.has("TWITCH_CLIENT_SECRET");
}

export async function getUser(
  clientId: string,
  accessToken: string,
  login: string | null,
) {
  const apiUrl = login
    ? `https://api.twitch.tv/helix/users?login=${login}`
    : `https://api.twitch.tv/helix/users`;
  const userResponse = await fetch(apiUrl, {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
    },
  }).then((res) => res.json());
  return userResponse.data[0];
}
