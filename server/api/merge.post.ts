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
    response.body.items.forEach((item: SpotifyApi.PlaylistTrackObject) => {
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

  const { urls, mergeMode } = await readBody(event);
  if (!urls || urls.length < 2) {
    throw createError({
      statusCode: 400,
      message: "플레이리스트 URL이 2개 이상 필요합니다.",
    });
  }

  if (!mergeMode || !['intersection', 'union'].includes(mergeMode)) {
    throw createError({
      statusCode: 400,
      message: "병합 방식(mergeMode)은 'intersection' 또는 'union'이어야 합니다.",
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
    const modeText = mergeMode === 'intersection' ? '교집합' : '합집합';
    const newPlaylistName = `[${modeText}] ${playlistInfos[0].name} & ${playlistInfos[1].name}`;
    const newPlaylist = await spotifyApi.createPlaylist(newPlaylistName, {
      description: `${playlistInfos.map(p => `'${p.name}'`).join(', ')}의 ${modeText} 병합`,
      public: true,
    });

    // --- 4. 병합 방식에 따른 곡 선택 및 추가 ---
    let tracksToAdd: string[] = [];
    
    if (mergeMode === 'intersection') {
      // 교집합: 모든 플레이리스트에 공통으로 있는 곡들
      if (allTrackSets.length > 0) {
        const firstSet = allTrackSets[0];
        const otherSets = allTrackSets.slice(1);
        tracksToAdd = [...firstSet].filter(uri => otherSets.every(set => set.has(uri)));
      }
    } else {
      // 합집합: 모든 플레이리스트의 곡들을 중복 없이
      const allUris = new Set<string>();
      allTrackSets.forEach(trackSet => {
        trackSet.forEach(uri => allUris.add(uri));
      });
      tracksToAdd = [...allUris];
    }
    
    if (tracksToAdd.length > 0) {
      // Spotify API limit: max 100 tracks per request
      for (let i = 0; i < tracksToAdd.length; i += 100) {
        const chunk = tracksToAdd.slice(i, i + 100);
        await spotifyApi.addTracksToPlaylist(newPlaylist.body.id, chunk);
      }
    }
    
    // --- 5. 성공 결과 반환 ---
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