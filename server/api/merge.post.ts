// server/api/merge.post.ts

import SpotifyWebApi from "spotify-web-api-node";
import { getCookie, setCookie } from "h3";

// .env 파일에서 클라이언트 정보 가져오기
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

/**
 * 플레이리스트의 모든 트랙 URI를 가져오는 함수 (팟캐스트 필터링 추가)
 */
async function getAllTrackUris(
  spotifyApi: SpotifyWebApi,
  playlistId: string
): Promise<Set<string>> {
  const trackUris = new Set<string>();
  let offset = 0;
  let total = 1;

  while (offset < total) {
    const response = await spotifyApi.getPlaylistTracks(playlistId, {
      limit: 50,
      offset,
    });
    response.body.items.forEach((item) => {
      if (item.track && item.track.uri && item.track.type === "track") {
        trackUris.add(item.track.uri);
      }
    });
    total = response.body.total;
    offset += response.body.items.length;
  }
  return trackUris;
}

export default defineEventHandler(async (event) => {
  // --- 1. 사용자 인증 확인 ---
  // 쿠키에서 access_token을 가져옵니다.
  const accessToken = getCookie(event, "spotify_access_token");

  if (!accessToken) {
    // access_token이 없으면 로그인/인증이 필요하다는 의미.
    // 실제 앱에서는 로그인 페이지로 보내야 합니다.
    throw createError({
      statusCode: 401, // Unauthorized
      message: "로그인이 필요합니다. 먼저 Spotify에 로그인해주세요.",
    });
  }

  // 인증된 사용자의 spotifyApi 인스턴스 생성
  const spotifyApi = new SpotifyWebApi({
    clientId,
    clientSecret,
    accessToken,
  });

  const { urls } = await readBody(event);
  if (!urls || urls.length < 2) {
    throw createError({
      statusCode: 400,
      message: "플레이리스트 URL이 2개 이상 필요합니다.",
    });
  }

  try {
    // --- 2. 플레이리스트 정보 로딩 ---
    const allTrackSets = await Promise.all(
      urls.map(async (url: string) => {
        const playlistId = new URL(url).pathname.split("/").pop()!;
        return getAllTrackUris(spotifyApi, playlistId);
      })
    );
    const playlistInfos = await Promise.all(
      urls.map(async (url: string) => {
        const playlistId = new URL(url).pathname.split("/").pop()!;
        return (await spotifyApi.getPlaylist(playlistId)).body;
      })
    );

    // --- 3. 새로운 플레이리스트 생성 ---
    const me = await spotifyApi.getMe();
    const newPlaylistName = `[통합] ${playlistInfos[0].name} & ${playlistInfos[1].name}`;
    const newPlaylist = await spotifyApi.createPlaylist(newPlaylistName, {
      description: `${playlistInfos.map(p => `'${p.name}'`).join(', ')}의 중복 곡과 추천 곡 모음`,
      public: true,
    });

    // --- 4. 중복 곡 찾기 및 추가 ---
    let duplicateUris: string[] = [];
    if (allTrackSets.length > 0) {
        const firstSet = allTrackSets[0];
        const otherSets = allTrackSets.slice(1);
        duplicateUris = [...firstSet].filter(uri => otherSets.every(set => set.has(uri)));
    }
    
    if (duplicateUris.length > 0) {
      // Spotify API limit: max 100 tracks per request
      for (let i = 0; i < duplicateUris.length; i += 100) {
        const chunk = duplicateUris.slice(i, i + 100);
        await spotifyApi.addTracksToPlaylist(newPlaylist.body.id, chunk);
      }
    }
    
    // --- 5. 중복되지 않은 곡으로 추천받기 및 추가 ---
    const allUris = new Set(allTrackSets.flatMap(s => [...s]));
    const uniqueTracks = [...allUris].filter(uri => !duplicateUris.includes(uri));
    
    const seedTracks = uniqueTracks
        .map((uri) => uri.split(":").pop()!)
        .slice(0, 5);

    if (seedTracks.length > 0) {
        let recommendations: SpotifyApi.RecommendationsFromSeedsResponse | null = null;
        try {
          // 1st attempt: up to 5 seed tracks
          const resp = await spotifyApi.getRecommendations({
            seed_tracks: seedTracks,
            limit: 20,
            min_popularity: 40,
          });
          recommendations = resp.body;
        } catch (e1: any) {
          console.warn("Recommendations attempt 1 failed:", e1?.body || e1?.message || e1);
          try {
            // 2nd attempt: single seed track
            const resp2 = await spotifyApi.getRecommendations({
              seed_tracks: seedTracks.slice(0, 1),
              limit: 20,
              min_popularity: 40,
            });
            recommendations = resp2.body;
          } catch (e2: any) {
            console.warn("Recommendations attempt 2 failed, skipping recommendations.", e2?.body || e2?.message || e2);
          }
        }

        if (recommendations) {
          const recommendedUris = recommendations.tracks
            .map((track) => track.uri)
            .filter((uri) => !allUris.has(uri));

          if (recommendedUris.length > 0) {
            for (let i = 0; i < recommendedUris.length; i += 100) {
              const chunk = recommendedUris.slice(i, i + 100);
              await spotifyApi.addTracksToPlaylist(newPlaylist.body.id, chunk);
            }
          }
        }
    }
    
    // --- 6. 성공 결과 반환 ---
    return { playlistUrl: newPlaylist.body.external_urls.spotify };

  } catch (error: any) {
    try {
      console.error("API Error full:", error);
    } catch {}
    console.error("API Error:", error?.body || error?.message || String(error));
    if (error.statusCode === 401) {
      // Access Token이 만료된 경우
      // 실제 앱에서는 Refresh Token으로 갱신하는 로직이 필요합니다.
      throw createError({
        statusCode: 401,
        message: "인증이 만료되었습니다. 다시 로그인해주세요.",
      });
    }
    throw createError({
      statusCode: 500,
      message: `Spotify API 처리 중 오류가 발생했습니다. ${error?.message ?? ''}`.trim(),
    });
  }
});