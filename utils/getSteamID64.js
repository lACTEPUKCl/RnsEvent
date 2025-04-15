import fetch from "node-fetch";

async function getSteamId64(steamApi, content) {
  const steamID64 = content.match(/\b[0-9]{17}\b/)?.[0];
  const vanityRegex = /^https?:\/\/steamcommunity.com\/id\/(?<steamId>.*)/;
  const groups = content.match(vanityRegex)?.groups;
  const vanity = groups?.steamId.split("/")[0];

  let resolvedSteamId = null;
  if (vanity) {
    try {
      const response = await fetch(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${steamApi}&vanityurl=${vanity}`
      );
      const data = await response.json();
      if (data.response.success === 1) {
        resolvedSteamId = data.response.steamid;
      }
    } catch (error) {
      return false;
    }
  }

  if (!resolvedSteamId && steamID64) {
    resolvedSteamId = steamID64;
  }

  if (!resolvedSteamId) return false;

  let squadHours = 0;
  try {
    const ownedGamesRes = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${steamApi}&steamid=${resolvedSteamId}&include_played_free_games=1&format=json`
    );
    const ownedGamesData = await ownedGamesRes.json();
    const squadGame = ownedGamesData.response?.games?.find(
      (game) => game.appid === 393380
    );
    if (squadGame && typeof squadGame.playtime_forever === "number") {
      squadHours = squadGame.playtime_forever / 60;
    }
  } catch (error) {
    console.error("Error fetching owned games:", error);
  }

  return { steamId: resolvedSteamId, squadHours };
}

export default getSteamId64;
