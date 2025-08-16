<template>
	<div class="max-w-3xl mx-auto p-4">
		<header class="mb-4">
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<i class="i-simple-icons-spotify text-emerald-500" />
				Spotify Playlist Merger
			</h1>
			<p class="text-sm text-neutral-500 mt-1">여러 플레이리스트를 합치고, 취향 기반 추천곡까지 한 번에.</p>
		</header>

		<UCard>
			<template #header>
				<div class="flex items-center justify-between">
					<span class="font-semibold">플레이리스트 URL 추가</span>
					<UButton
						color="neutral"
						variant="soft"
						size="xs"
						icon="i-heroicons-information-circle"
						@click="toast.add({ title: '예시', description: 'https://open.spotify.com/playlist/...' })"
					/>
				</div>
			</template>

			<div class="flex gap-2 mb-3">
				<UInput
					v-model="newUrl"
					placeholder="https://open.spotify.com/playlist/..."
					class="flex-grow"
					icon="i-simple-icons-spotify"
					@keydown.enter="addUrl"
				/>
				<UButton @click="addUrl" label="추가" :disabled="!newUrl" />
			</div>

			<div v-if="playlistUrls.length" class="space-y-2 mb-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-neutral-500">총 {{ playlistUrls.length }}개</p>
					<UButton color="neutral" variant="ghost" size="xs" icon="i-heroicons-trash" @click="clearAll" />
				</div>
				<div class="flex flex-wrap gap-2">
					<div
						v-for="(url, index) in playlistUrls"
						:key="url + index"
						class="flex items-center gap-2 px-3 py-2 rounded-md bg-neutral-100 dark:bg-neutral-800 max-w-full"
					>
						<UBadge color="success" variant="soft">{{ index + 1 }}</UBadge>
						<span class="text-sm truncate max-w-[32ch]" :title="url">{{ url }}</span>
						<UButton
							@click="removeUrl(index)"
							color="error"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							size="xs"
						/>
					</div>
				</div>

				<!-- Previews -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
					<UCard v-for="(url, idx) in playlistUrls" :key="'preview-' + url + idx">
						<template #header>
							<span class="text-sm font-medium truncate" :title="previews[url]?.title || url">
								{{ previews[url]?.title || '미리보기 로딩 중...' }}
							</span>
						</template>
						<div class="aspect-video overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
							<img v-if="previews[url]?.thumbnail_url" :src="previews[url]?.thumbnail_url" alt="preview" class="w-full h-full object-cover" />
							<USkeleton v-else class="w-full h-full" />
						</div>
					</UCard>
				</div>
			</div>
			<div v-else class="text-center text-neutral-500 mb-4">
				<p>병합할 플레이리스트 URL을 2개 이상 추가해주세요.</p>
			</div>

			<UButton
				@click="mergePlaylists"
				label="모든 플레이리스트 병합 및 추천 시작"
				size="xl"
				block
				:loading="isLoading"
				:disabled="playlistUrls.length < 2"
			/>

			<!-- Loader details -->
			<div v-if="isLoading" class="mt-4 space-y-2">
				<p class="text-sm text-neutral-500">{{ loadingLabel }} ({{ elapsed }}s)</p>
				<UProgress size="lg" :indeterminate="true" />
			</div>

			<UAlert
				v-if="resultPlaylistUrl"
				:title="`병합 완료!`"
				icon="i-heroicons-check-circle"
				color="primary"
				variant="solid"
				class="mt-6"
			>
				<template #description>
					<p>
						새로운 플레이리스트가 생성되었습니다!
						<a
							:href="resultPlaylistUrl"
							target="_blank"
							class="underline font-bold"
							>여기서 확인하세요.</a
						>
					</p>
				</template>
			</UAlert>
		</UCard>

		<footer class="mt-6 text-center text-xs text-neutral-500">Spotify Web API 기반 · 개인정보 저장 없음</footer>

		<!-- Nuxt UI Toasts -->
		<ClientOnly>
			<UNotifications />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useToast } from "#imports";

const toast = useToast();

const newUrl = ref("");
const playlistUrls = ref<string[]>([
	"https://open.spotify.com/playlist/3MvzvjEXAeZ79j98nKvm79?si=ffeca9b7584d414e",
	"https://open.spotify.com/playlist/120xsfyKwVLnnkBR0LbP6q?si=z48se06cShK6eBDFdAfPfw&pi=HDYYxnXiSHqBh",
]);
const isLoading = ref(false);
const resultPlaylistUrl = ref<string | null>(null);
const loadingLabel = ref("요청 준비 중...");
const elapsed = ref(0);
let timer: any = null;

type Preview = { title?: string; thumbnail_url?: string };
const previews = ref<Record<string, Preview>>({});

// Extract and validate playlist ID
const extractPlaylistId = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.hostname !== "open.spotify.com") return null;
    const m = u.pathname.match(/^\/playlist\/([a-zA-Z0-9]{22})(?:$|\/)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
};
const isValidPlaylistUrl = (url: string) => Boolean(extractPlaylistId(url));

const addUrl = () => {
	const url = newUrl.value.trim();
	if (!url) return;
	if (!isValidPlaylistUrl(url)) {
		toast.add({ title: "유효하지 않은 URL", description: "Spotify 플레이리스트 URL을 입력해주세요.", color: "error" });
		return;
	}
	if (playlistUrls.value.includes(url)) {
		toast.add({ title: "중복 URL", description: "이미 추가된 URL입니다.", color: "warning" });
		return;
	}
	playlistUrls.value.push(url);
	newUrl.value = "";
	resultPlaylistUrl.value = null; // 새 URL 추가 시 결과창 숨기기
	void fetchPreview(url);
};

const clearAll = () => {
    playlistUrls.value = [];
    previews.value = {};
    resultPlaylistUrl.value = null;
};

const removeUrl = (index: number) => {
	const [removed] = playlistUrls.value.splice(index, 1);
	if (removed) delete previews.value[removed];
};

const mergePlaylists = async () => {
	if (playlistUrls.value.length < 2) {
		toast.add({ title: "최소 2개 필요", description: "2개 이상의 플레이리스트 URL을 추가해주세요.", color: "warning" });
		return;
	}
	isLoading.value = true;
	loadingLabel.value = "서버에 요청 전송 중...";
	elapsed.value = 0;
	if (timer) clearInterval(timer);
	timer = setInterval(() => { elapsed.value += 1; if (elapsed.value > 2) loadingLabel.value = "병합 처리 중..."; }, 1000);
	resultPlaylistUrl.value = null;
	try {
		// 백엔드 API에 병합 요청
		const response = await $fetch<{ playlistUrl: string }>("/api/merge", {
			method: "POST",
			body: { urls: playlistUrls.value },
		});
		resultPlaylistUrl.value = response.playlistUrl;
		toast.add({ title: "병합 완료", description: "새 플레이리스트가 생성되었습니다." });
	} catch (error: any) {
		console.error("병합 중 오류 발생:", error);
		const status = error?.statusCode || error?.response?.status;
		if (status === 401) {
			// 인증 필요: 로그인 엔드포인트로 리다이렉트
			window.location.href = "/api/login";
			return;
		}
		toast.add({ title: "병합 실패", description: "서버 로그를 확인해주세요.", color: "error" });
	} finally {
		isLoading.value = false;
		loadingLabel.value = "완료";
		if (timer) clearInterval(timer);
	}
};

// Fetch oEmbed previews for initial URLs
const fetchPreview = async (url: string) => {
	try {
		const data = await $fetch<any>("https://open.spotify.com/oembed", {
			params: { url },
		});
		previews.value[url] = { title: data?.title, thumbnail_url: data?.thumbnail_url };
	} catch (e) {
		previews.value[url] = {};
	}
};

onMounted(() => {
  for (const url of playlistUrls.value) void fetchPreview(url);
});
</script>
