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
