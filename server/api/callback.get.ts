// server/api/callback.get.ts
import SpotifyWebApi from "spotify-web-api-node";
import { H3Event, setCookie } from "h3";

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

export default defineEventHandler(async (event: H3Event) => {
  const code = getQuery(event).code as string | undefined;
  if (!code) {
    throw createError({ statusCode: 400, message: "코드가 없습니다." });
  }

  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: ".env에 SPOTIFY_CLIENT_ID/SECRET이 필요합니다." });
  }

  const { origin } = getRequestURL(event);
  const redirectUri = `${origin}/api/callback`;
  const spotifyApi = new SpotifyWebApi({ clientId, clientSecret, redirectUri });

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const accessToken = data.body.access_token;
    const refreshToken = data.body.refresh_token;
    const expiresIn = data.body.expires_in; // seconds

    // Set cookies
    // Access token cookie (HTTP-only for server usage)
    setCookie(event, "spotify_access_token", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: expiresIn,
    });

    // Optionally store refresh token (secure; needed for real apps)
    if (refreshToken) {
      setCookie(event, "spotify_refresh_token", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        // Spotify refresh tokens typically long-lived; set a long maxAge
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    // Redirect back to home after login
    return sendRedirect(event, "/");
  } catch (err: any) {
    console.error("Auth Error:", err.body || err.message || err);
    throw createError({ statusCode: 500, message: "Spotify 인증 실패" });
  }
});
