// nuxt.config.ts
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },

	// gtag는 사용하지 않으므로 제거
	modules: ["@nuxt/ui", "@nuxtjs/i18n"],

	css: ["~/assets/css/main.css"],

	i18n: {
		locales: [
			{ code: "ko", name: "Korean", file: "ko.json" },
			{ code: "en", name: "English", file: "en.json" },
		],
		langDir: "locales/",
		defaultLocale: "en",
		strategy: "no_prefix",
		detectBrowserLanguage: {
			useCookie: true,
			cookieKey: "i18n_locale",
			redirectOn: "root",
			alwaysRedirect: true,
			fallbackLocale: "en",
		},
	},

	// runtimeConfig에 public로 노출 (클라이언트에서 사용할 수 있게)
	runtimeConfig: {
		public: {
			ADSENSE_CLIENT: process.env.GOOGLE_ADSENSE_ID, // ex) ca-pub-XXXXXXXXXXXXXXXX
		},
	},

	app: {
		head: {
			script: [
				{
					async: true,
					crossorigin: "anonymous",
					// dev에서도 테스트하고 싶으므로 분기 없이 항상 로드
					// .env: NUXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
					src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NUXT_PUBLIC_ADSENSE_CLIENT}`,
				},
			],
		},
	},
});
