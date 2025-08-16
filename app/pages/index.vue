<template>
	<div class="max-w-3xl mx-auto p-4">
		<header class="mb-4">
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<i class="i-simple-icons-spotify text-emerald-500" />
				Spotify Playlist Merger
			</h1>
			<p class="text-sm text-neutral-500 mt-1">
				여러 플레이리스트를 교집합 또는 합집합으로 병합합니다.
			</p>
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
						@click="
							toast.add({
								title: '예시',
								description: 'https://open.spotify.com/playlist/...',
							})
						"
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
				>
					<template #trailing>
						<UButton
							@click="pasteFromClipboard"
							color="neutral"
							variant="ghost"
							icon="i-heroicons-clipboard"
							size="xs"
							:disabled="!canPaste"
						/>
					</template>
				</UInput>
				<UButton @click="addUrl" label="추가" :disabled="!newUrl" />
			</div>

			<div v-if="playlistUrls.length" class="space-y-2 mb-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-neutral-500">총 {{ playlistUrls.length }}개</p>
					<UButton
						color="neutral"
						variant="ghost"
						size="xs"
						icon="i-heroicons-trash"
						@click="clearAll"
					/>
				</div>

				<!-- Previews -->
				<div class="space-y-2 mt-3">
					<div
						v-for="(url, idx) in playlistUrls"
						:key="'preview-' + url + idx"
						class="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
					>
						<!-- Thumbnail -->
						<div
							class="w-12 h-12 rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0"
						>
							<img
								v-if="previews[url]?.thumbnail_url"
								:src="previews[url]?.thumbnail_url"
								alt="playlist thumbnail"
								class="w-full h-full object-cover"
							/>
							<USkeleton v-else class="w-full h-full" />
						</div>

						<!-- Playlist name -->
						<div class="flex-grow min-w-0">
							<p
								class="text-sm font-medium truncate"
								:title="previews[url]?.title || url"
							>
								{{ previews[url]?.title || "미리보기 로딩 중..." }}
							</p>
							<p class="text-xs text-neutral-500 truncate" :title="url">
								{{ url }}
							</p>
						</div>

						<!-- Delete button -->
						<UButton
							@click="removeUrl(idx)"
							color="error"
							variant="ghost"
							icon="i-heroicons-trash"
							size="xs"
							class="flex-shrink-0"
						/>
					</div>
				</div>
			</div>
			<div v-else class="text-center text-neutral-500 mb-4">
				<p>병합할 플레이리스트 URL을 2개 이상 추가해주세요.</p>
			</div>

			<!-- Merge mode selection -->
			<div v-if="playlistUrls.length >= 2" class="mb-6 text-center">
				<UFormGroup label="병합 방식" class="mb-4">
					<div class="flex items-center justify-center gap-4">
						<span
							class="text-sm font-medium"
							:class="
								mergeMode === 'union'
									? 'text-primary-600 dark:text-primary-400'
									: 'text-neutral-500'
							"
						>
							합집합 (모든 곡)
						</span>
						<USwitch 
							v-model="toggleValue" 
							size="md"
							:ui="{
								active: 'bg-primary-500 dark:bg-primary-400',
								inactive: 'bg-neutral-200 dark:bg-neutral-700'
							}"
						/>
						<span
							class="text-sm font-medium"
							:class="
								mergeMode === 'intersection'
									? 'text-primary-600 dark:text-primary-400'
									: 'text-neutral-500'
							"
						>
							교집합 (공통 곡만)
						</span>
					</div>
				</UFormGroup>
				<div class="text-xs text-neutral-500 max-w-md mx-auto">
					<p
						v-if="mergeMode === 'intersection'"
						class="flex items-center justify-center gap-2"
					>
						<span>∩</span>
						<span
							><strong>교집합:</strong> 모든 플레이리스트에 공통으로 있는 곡들만
							포함됩니다.</span
						>
					</p>
					<p v-else class="flex items-center justify-center gap-2">
						<span>∪</span>
						<span
							><strong>합집합:</strong> 모든 플레이리스트의 곡들을 중복 없이
							모두 포함됩니다.</span
						>
					</p>
				</div>
			</div>

			<UButton
				@click="mergePlaylists"
				:label="getMergeButtonLabel()"
				size="xl"
				block
				:loading="isLoading"
				:disabled="playlistUrls.length < 2"
			/>

			<!-- Loader details -->
			<div v-if="isLoading" class="mt-4 space-y-2">
				<p class="text-sm text-neutral-500">
					{{ loadingLabel }} ({{ elapsed }}s)
				</p>
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

		<footer class="mt-6 text-center text-xs text-neutral-500">
			Spotify Web API 기반 · 개인정보 저장 없음
		</footer>

		<!-- Nuxt UI Toasts -->
		<ClientOnly>
			<UNotifications />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useToast } from "#imports";

const toast = useToast();

const newUrl = ref("");
const playlistUrls = ref<string[]>([
	"https://open.spotify.com/playlist/5Gydx9caE2KuoqHHpjTk3B?si=9b9b52e3367e4d41",
	"https://open.spotify.com/playlist/6QzgwG1smZwMuaNNQCZeU1?si=pG_B2IgvTqyINzXlJYHIVg&pi=WH6RtsGORDudE",
]);
const isLoading = ref(false);
const resultPlaylistUrl = ref<string | null>(null);
const loadingLabel = ref("요청 준비 중...");
const elapsed = ref(0);
let timer: any = null;

// Clipboard functionality
const canPaste = ref(false);

// Merge mode selection
const mergeMode = ref<"intersection" | "union">("union");
const toggleValue = ref(false); // false = union, true = intersection

// Watch toggleValue to update mergeMode
watch(toggleValue, (newValue) => {
	mergeMode.value = newValue ? "intersection" : "union";
});

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
		toast.add({
			title: "유효하지 않은 URL",
			description: "Spotify 플레이리스트 URL을 입력해주세요.",
			color: "error",
		});
		return;
	}
	if (playlistUrls.value.includes(url)) {
		toast.add({
			title: "중복 URL",
			description: "이미 추가된 URL입니다.",
			color: "warning",
		});
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

// Clipboard paste functionality
const pasteFromClipboard = async () => {
	try {
		const text = await navigator.clipboard.readText();
		const trimmedText = text.trim();

		if (trimmedText) {
			newUrl.value = trimmedText;

			// Automatically add if it's a valid URL
			if (isValidPlaylistUrl(trimmedText)) {
				if (playlistUrls.value.includes(trimmedText)) {
					toast.add({
						title: "중복 URL",
						description: "이미 추가된 URL입니다.",
						color: "warning",
					});
				} else {
					playlistUrls.value.push(trimmedText);
					newUrl.value = "";
					resultPlaylistUrl.value = null;
					void fetchPreview(trimmedText);
					toast.add({
						title: "플레이리스트 추가 완료",
						description: "클립보드에서 URL을 자동으로 추가했습니다.",
						color: "success",
					});
				}
			} else {
				toast.add({
					title: "유효하지 않은 URL",
					description: "Spotify 플레이리스트 URL을 입력해주세요.",
					color: "error",
				});
			}
		} else {
			toast.add({
				title: "클립보드가 비어있음",
				description: "클립보드에 URL을 복사한 후 다시 시도해주세요.",
				color: "warning",
			});
		}
	} catch (error) {
		toast.add({
			title: "붙여넣기 실패",
			description: "클립보드 접근 권한을 확인해주세요.",
			color: "error",
		});
	}
};

const getMergeButtonLabel = () => {
	if (mergeMode.value === "intersection") {
		return "교집합으로 플레이리스트 병합";
	} else {
		return "합집합으로 플레이리스트 병합";
	}
};

const mergePlaylists = async () => {
	if (playlistUrls.value.length < 2) {
		toast.add({
			title: "최소 2개 필요",
			description: "2개 이상의 플레이리스트 URL을 추가해주세요.",
			color: "warning",
		});
		return;
	}
	isLoading.value = true;
	loadingLabel.value = "서버에 요청 전송 중...";
	elapsed.value = 0;
	if (timer) clearInterval(timer);
	timer = setInterval(() => {
		elapsed.value += 1;
		if (elapsed.value > 2) loadingLabel.value = "병합 처리 중...";
	}, 1000);
	resultPlaylistUrl.value = null;
	try {
		// 백엔드 API에 병합 요청
		const response = await $fetch<{ playlistUrl: string }>("/api/merge", {
			method: "POST",
			body: {
				urls: playlistUrls.value,
				mergeMode: mergeMode.value,
			},
		});
		resultPlaylistUrl.value = response.playlistUrl;
		const modeText = mergeMode.value === "intersection" ? "교집합" : "합집합";
		toast.add({
			title: "병합 완료",
			description: `${modeText} 방식으로 새 플레이리스트가 생성되었습니다.`,
		});
	} catch (error: any) {
		console.error("병합 중 오류 발생:", error);
		const status = error?.statusCode || error?.response?.status;
		if (status === 401) {
			// 인증 필요: 로그인 엔드포인트로 리다이렉트
			window.location.href = "/api/login";
			return;
		}
		toast.add({
			title: "병합 실패",
			description: "서버 로그를 확인해주세요.",
			color: "error",
		});
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
		previews.value[url] = {
			title: data?.title,
			thumbnail_url: data?.thumbnail_url,
		};
	} catch (e) {
		previews.value[url] = {};
	}
};

onMounted(() => {
	for (const url of playlistUrls.value) void fetchPreview(url);

	// Check if clipboard API is available
	canPaste.value = !!navigator?.clipboard?.readText;
});
</script>
