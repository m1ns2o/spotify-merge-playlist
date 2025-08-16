// server/api/login.get.ts
import { H3Event } from "h3";

export default defineEventHandler((event: H3Event) => {
	const scopes = [
		"playlist-read-private",
		"playlist-modify-public",
		"playlist-modify-private",
	];
	const clientId = process.env.SPOTIFY_CLIENT_ID;
	const { origin } = getRequestURL(event);
	const redirectUri = `${origin}/api/callback`;

	const authUrl =
		"https://accounts.spotify.com/authorize?" +
		new URLSearchParams({
			response_type: "code",
			client_id: clientId!,
			scope: scopes.join(" "),
			redirect_uri: redirectUri,
		}).toString();

	// 사용자를 스포티파이 인증 URL로 리다이렉트
	return sendRedirect(event, authUrl);
});
