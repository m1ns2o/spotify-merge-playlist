<template>
	<div class="max-w-3xl mx-auto p-4">
		<header class="mb-4">
			<h1 class="text-2xl font-bold flex items-center2">
				<i class="i-simple-icons-spotify text-emerald-500" />
				{{ $t('app.title') }}
			</h1>
			<p class="text-sm text-neutral-500 mt-1">
				{{ $t('app.description') }}
			</p>
		</header>

		<UCard>
			<template #header>
				<div class="flex items-center justify-between">
					<span class="font-semibold">{{ $t('playlist.addTitle') }}</span>
					<UButton
						color="neutral"
						variant="soft"
						size="xs"
						icon="i-heroicons-information-circle"
						@click="
							toast.add({
								title: $t('playlist.exampleToast.title'),
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
				<UButton @click="addUrl" :label="$t('playlist.addButton')" :disabled="!newUrl" />
			</div>

			<div v-if="playlistUrls.length" class="space-y-2 mb-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-neutral-500">{{ $t('playlist.totalCount', { count: playlistUrls.length }) }}</p>
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
								{{ previews[url]?.title || $t('playlist.loadingPreview') }}
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
				<p>{{ $t('playlist.addAtLeastTwo') }}</p>
			</div>

			<!-- Merge mode selection -->
			<div v-if="playlistUrls.length >= 2" class="mb-6 text-center">
				<UFormGroup :label="$t('merge.modeTitle')" class="mb-4">
					<div class="flex items-center justify-center gap-4">
						<span
							class="text-sm font-medium"
							:class="
								mergeMode === 'union'
									? 'text-primary-600 dark:text-primary-400'
									: 'text-neutral-500'
							"
						>
							{{ $t('merge.union') }}
						</span>
						<USwitch 
							v-model="toggleValue" 
							size="md"
							
						/>
						<span
							class="text-sm font-medium"
							:class="
								mergeMode === 'intersection'
									? 'text-primary-600 dark:text-primary-400'
									: 'text-neutral-500'
							"
						>
							{{ $t('merge.intersection') }}
						</span>
					</div>
				</UFormGroup>
				<div class="text-xs text-neutral-500 max-w-md mx-auto">
					<p
						v-if="mergeMode === 'intersection'"
						class="flex items-center justify-center gap-2"
					>
						<span>∩</span>
						<span>{{ $t('merge.intersectionDescription') }}</span>
					</p>
					<p v-else class="flex items-center justify-center gap-2">
						<span>∪</span>
						<span>{{ $t('merge.unionDescription') }}</span>
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
				:title="$t('success.title')"
				icon="i-heroicons-check-circle"
				color="primary"
				variant="solid"
				class="mt-6"
			>
				<template #description>
					<p>
						{{ $t('success.description') }}
						<a
							:href="resultPlaylistUrl"
							target="_blank"
							class="underline font-bold"
							>{{ $t('success.link') }}</a
						>
					</p>
				</template>
			</UAlert>
		</UCard>

		<footer class="mt-6 text-center text-xs text-neutral-500">
			{{ $t('app.footer') }}
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
const loadingLabel = ref("");
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
			title: t("error.invalidUrl.title"),
			description: t("error.invalidUrl.description"),
			color: "error",
		});
		return;
	}
	if (playlistUrls.value.includes(url)) {
		toast.add({
			title: t("error.duplicateUrl.title"),
			description: t("error.duplicateUrl.description"),
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
						title: t("error.duplicateUrl.title"),
						description: t("error.duplicateUrl.description"),
						color: "warning",
					});
				} else {
					playlistUrls.value.push(trimmedText);
					newUrl.value = "";
					resultPlaylistUrl.value = null;
					void fetchPreview(trimmedText);
					toast.add({
						title: t("clipboard.pasteSuccess.title"),
						description: t("clipboard.pasteSuccess.description"),
						color: "success",
					});
				}
			} else {
				toast.add({
					title: t("error.invalidUrl.title"),
					description: t("error.invalidUrl.description"),
					color: "error",
				});
			}
		} else {
			toast.add({
				title: t("clipboard.empty.title"),
				description: t("clipboard.empty.description"),
				color: "warning",
			});
		}
	} catch (error) {
		toast.add({
			title: t("clipboard.failed.title"),
			description: t("clipboard.failed.description"),
			color: "error",
		});
	}
};

const { t } = useI18n()

const getMergeButtonLabel = () => {
	if (mergeMode.value === "intersection") {
		return t("merge.buttonIntersection");
	} else {
		return t("merge.buttonUnion");
	}
};

const mergePlaylists = async () => {
	if (playlistUrls.value.length < 2) {
		toast.add({
			title: t("error.minimumRequired.title"),
			description: t("error.minimumRequired.description"),
			color: "warning",
		});
		return;
	}
	isLoading.value = true;
	loadingLabel.value = t("loading.preparing");
	elapsed.value = 0;
	if (timer) clearInterval(timer);
	timer = setInterval(() => {
		elapsed.value += 1;
		if (elapsed.value > 2) loadingLabel.value = t("loading.processing");
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
		const modeText = mergeMode.value === "intersection" 
			? t("merge.intersection") 
			: t("merge.union");
		toast.add({
			title: t("success.title"),
			description: t("success.modeComplete", { mode: modeText }),
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
			title: t("error.mergeFailed.title"),
			description: t("error.mergeFailed.description"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
		loadingLabel.value = t("loading.complete");
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
