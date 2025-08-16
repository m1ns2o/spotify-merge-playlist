// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	modules: ["@nuxt/ui", "@nuxtjs/i18n"],
	css: ["~/assets/css/main.css"],
	i18n: {
		locales: [
			{
				code: 'ko',
				name: 'Korean',
				file: 'ko.json'
			},
			{
				code: 'en',
				name: 'English',
				file: 'en.json'
			}
		],
		langDir: 'locales/',
		defaultLocale: 'en',
		strategy: 'no_prefix',
		detectBrowserLanguage: {
			useCookie: true,
			cookieKey: 'i18n_locale',
			redirectOn: 'root',
			alwaysRedirect: true,
			fallbackLocale: 'en'
		}
	}
});
