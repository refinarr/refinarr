# Changelog

## [0.8.2](https://github.com/refinarr/refinarr/compare/v0.8.1...v0.8.2) (2026-06-03)


### Bug Fixes

* Phase 5 QA-5 a11y + disk-full resilience ([#105](https://github.com/refinarr/refinarr/issues/105)/[#106](https://github.com/refinarr/refinarr/issues/106)/[#107](https://github.com/refinarr/refinarr/issues/107)) ([#109](https://github.com/refinarr/refinarr/issues/109)) ([bbea104](https://github.com/refinarr/refinarr/commit/bbea104807e2930d8ce451c0ed95f2078e3fc604))

## [0.8.1](https://github.com/refinarr/refinarr/compare/v0.8.0...v0.8.1) (2026-06-03)


### Bug Fixes

* cut 0.8.1 with the Phase 4 QA-4 fixes ([#103](https://github.com/refinarr/refinarr/issues/103)) ([fccdd1a](https://github.com/refinarr/refinarr/commit/fccdd1a444cf6e8088385dcf4daf2c2db2ed8231))

## [0.8.0](https://github.com/refinarr/refinarr/compare/v0.7.0...v0.8.0) (2026-06-03)


### Features

* interactive search + force-grab (movie + Sonarr season) ([#99](https://github.com/refinarr/refinarr/issues/99)) ([1f08ff2](https://github.com/refinarr/refinarr/commit/1f08ff29c510a440465eac0bc4cf2815d7eb20ae))
* remove manual scoring mode ([#97](https://github.com/refinarr/refinarr/issues/97)) ([9bb2134](https://github.com/refinarr/refinarr/commit/9bb2134f0ac3b8a4883dad09aedc83a0d9b865b2))

## [0.7.0](https://github.com/refinarr/refinarr/compare/v0.6.2...v0.7.0) (2026-06-02)


### Features

* **ui:** card redesign, poster grid & mobile swipe actions ([#91](https://github.com/refinarr/refinarr/issues/91)) ([6d7147d](https://github.com/refinarr/refinarr/commit/6d7147dd0f041bdedc7dc5306a10e94656ae373d))

## [0.6.2](https://github.com/refinarr/refinarr/compare/v0.6.1...v0.6.2) (2026-06-01)


### Bug Fixes

* **ui:** eliminate cold-load layout shift — sidebar shell + dashboard + history ([#75](https://github.com/refinarr/refinarr/issues/75)) ([3878144](https://github.com/refinarr/refinarr/commit/3878144182e4c5fca9531efd7c8dc62c47705d33))
* **ui:** meet 44pt touch targets on mobile ([#89](https://github.com/refinarr/refinarr/issues/89)) ([3022f2d](https://github.com/refinarr/refinarr/commit/3022f2dcdc781166f6a9a0bf822178e06188eb62))

## [0.6.1](https://github.com/refinarr/refinarr/compare/v0.6.0...v0.6.1) (2026-05-31)


### Bug Fixes

* **docker:** make graceful shutdown actually fire on SIGTERM ([#72](https://github.com/refinarr/refinarr/issues/72)) ([a322caf](https://github.com/refinarr/refinarr/commit/a322cafdd363617422643e80adf7adc4b510fac0))
* **server:** move instrumentation.ts to src/ so the standalone build loads it ([#74](https://github.com/refinarr/refinarr/issues/74)) ([3b73b8c](https://github.com/refinarr/refinarr/commit/3b73b8c1607acfb57f0541cd8599c8a3afe357e8))

## [0.6.0](https://github.com/refinarr/refinarr/compare/v0.5.11...v0.6.0) (2026-05-31)


### Features

* graceful shutdown on SIGTERM/SIGINT ([#70](https://github.com/refinarr/refinarr/issues/70)) ([c037eb1](https://github.com/refinarr/refinarr/commit/c037eb1dfa2844b3e8196aecd01b0b2d5b779f3d))


### Bug Fixes

* **ui:** match KpiCard skeleton header height (no dashboard layout shift) ([#67](https://github.com/refinarr/refinarr/issues/67)) ([6219c18](https://github.com/refinarr/refinarr/commit/6219c18d34e8b1fadad4cddb17d6c9977347c10f))
* **ui:** match loading skeletons to their real shape (no layout shift) ([#68](https://github.com/refinarr/refinarr/issues/68)) ([1021892](https://github.com/refinarr/refinarr/commit/1021892ca8e41f1316a5848472e78041500b1ff8))


### Performance Improvements

* **docker:** slim + speed the entrypoint (drop shadow, fingerprint-skip migrate) ([#71](https://github.com/refinarr/refinarr/issues/71)) ([7f7ad95](https://github.com/refinarr/refinarr/commit/7f7ad95cbd5d6d6d00ff807803b761ab0e74fdab))

## [0.5.11](https://github.com/refinarr/refinarr/compare/v0.5.10...v0.5.11) (2026-05-31)


### Bug Fixes

* **e2e:** seed both arr types in mobile tab-bar test (gating race) ([#59](https://github.com/refinarr/refinarr/issues/59)) ([584b6aa](https://github.com/refinarr/refinarr/commit/584b6aa16e20c5f572c219e52973e66f705e58cb))


### Performance Improvements

* **api:** Cache-Control on qualityprofiles reads ([#62](https://github.com/refinarr/refinarr/issues/62)) ([dc37e2f](https://github.com/refinarr/refinarr/commit/dc37e2f7645aef6a222353b188d7cce1f5fb9350))
* **api:** project heavy fields out of dashboard recent-activity ([#66](https://github.com/refinarr/refinarr/issues/66)) ([4d1efcb](https://github.com/refinarr/refinarr/commit/4d1efcbb580fc2cbb25e143f242c41435821bf16))
* **client:** tune staleTime / refetchOnWindowFocus on config + history queries ([#65](https://github.com/refinarr/refinarr/issues/65)) ([fab8fad](https://github.com/refinarr/refinarr/commit/fab8fad87b65ffd9c362ab1a728b6df30461868b))
* **docker:** prune Prisma Studio UI from the image (~31MB) ([#58](https://github.com/refinarr/refinarr/issues/58)) ([bd38144](https://github.com/refinarr/refinarr/commit/bd38144b053f51a6159ec53b13e51b69c6c5ea5a))
* optimizePackageImports for non-default barrel packages ([#64](https://github.com/refinarr/refinarr/issues/64)) ([249db92](https://github.com/refinarr/refinarr/commit/249db92e10e685cd5cbf05b7d369671eecc6a552))
* parallelize worker boot ([#61](https://github.com/refinarr/refinarr/issues/61)) ([af7dfb3](https://github.com/refinarr/refinarr/commit/af7dfb33fb33fe0642ca3ae31b929340fa431723))
* **ui:** seed active instance from localStorage (kill selection waterfall) ([#63](https://github.com/refinarr/refinarr/issues/63)) ([26346e3](https://github.com/refinarr/refinarr/commit/26346e3035149d248bb1880ddeef5738c21ddc92))

## [0.5.10](https://github.com/refinarr/refinarr/compare/v0.5.9...v0.5.10) (2026-05-31)


### Bug Fixes

* **a11y:** clear color-contrast AA failures (destructive + history sub-line) ([#47](https://github.com/refinarr/refinarr/issues/47)) ([#55](https://github.com/refinarr/refinarr/issues/55)) ([5f0ba5b](https://github.com/refinarr/refinarr/commit/5f0ba5b9fa1a0084c8bbfb6c555b6c9c38328d0e))
* **ui:** gate per-arr surfaces by configured instance types ([#53](https://github.com/refinarr/refinarr/issues/53)) ([#56](https://github.com/refinarr/refinarr/issues/56)) ([7b7dac2](https://github.com/refinarr/refinarr/commit/7b7dac2d1324f2db5a18cca93b95b7ade2271922))
* **ui:** point add-instance CTAs at /settings/instances, not /settings ([#54](https://github.com/refinarr/refinarr/issues/54)) ([6fd56fa](https://github.com/refinarr/refinarr/commit/6fd56fac8c820cef8c658eba5efbbc24ecafbfab))

## [0.5.9](https://github.com/refinarr/refinarr/compare/v0.5.8...v0.5.9) (2026-05-31)


### Bug Fixes

* **a11y:** name history filters, monitored header, dry-run toggle ([#40](https://github.com/refinarr/refinarr/issues/40), [#41](https://github.com/refinarr/refinarr/issues/41), [#42](https://github.com/refinarr/refinarr/issues/42)) ([#44](https://github.com/refinarr/refinarr/issues/44)) ([f31dd57](https://github.com/refinarr/refinarr/commit/f31dd5792f742bb69e16d425547baaddb17cb877))
* **auto-search:** gate in-flight media + record grabbed release ([#39](https://github.com/refinarr/refinarr/issues/39)) ([#45](https://github.com/refinarr/refinarr/issues/45)) ([a3bbb3e](https://github.com/refinarr/refinarr/commit/a3bbb3e0853ab7c5e49584794daad17ab9f9ec2c))

## [0.5.8](https://github.com/refinarr/refinarr/compare/v0.5.7...v0.5.8) (2026-05-31)


### Bug Fixes

* **api:** reject out-of-band media query values with 400 ([#36](https://github.com/refinarr/refinarr/issues/36)) ([#38](https://github.com/refinarr/refinarr/issues/38)) ([6f2c666](https://github.com/refinarr/refinarr/commit/6f2c666093ed15ecf0962a2c0d12f1fccf1ea984))

## [0.5.7](https://github.com/refinarr/refinarr/compare/v0.5.6...v0.5.7) (2026-05-31)


### Bug Fixes

* **ui:** finish 44pt touch targets + document async-search API contract ([#29](https://github.com/refinarr/refinarr/issues/29)) ([#35](https://github.com/refinarr/refinarr/issues/35)) ([6283ac2](https://github.com/refinarr/refinarr/commit/6283ac2b1bbeb1f4fd25de8dce6fca0cd27288bc))

## [0.5.6](https://github.com/refinarr/refinarr/compare/v0.5.5...v0.5.6) (2026-05-31)


### Bug Fixes

* **auto-runner:** close runNow() mutex TOCTOU window ([#30](https://github.com/refinarr/refinarr/issues/30)) ([#31](https://github.com/refinarr/refinarr/issues/31)) ([4339eba](https://github.com/refinarr/refinarr/commit/4339ebabadf2e283faf1d3e3d899127c14bb88a0))
* QA Phase 4 R2 batch — 502 on unreachable *arr ([#26](https://github.com/refinarr/refinarr/issues/26)) + mobile touch targets ([#29](https://github.com/refinarr/refinarr/issues/29)) ([#33](https://github.com/refinarr/refinarr/issues/33)) ([4c591e5](https://github.com/refinarr/refinarr/commit/4c591e54dad9d13d7aaba44fe01e50cfe7c25099))

## [0.5.5](https://github.com/refinarr/refinarr/compare/v0.5.4...v0.5.5) (2026-05-31)


### Bug Fixes

* address QA Phase 1 bugs & gaps (BUG-1/2, GAP-1–9) ([#18](https://github.com/refinarr/refinarr/issues/18)) ([5cc1072](https://github.com/refinarr/refinarr/commit/5cc10720d69b957eabf9f450611a0edee9e98101))
* **auth:** enforce confirmPassword server-side on password change ([#21](https://github.com/refinarr/refinarr/issues/21)) ([039738a](https://github.com/refinarr/refinarr/commit/039738abe53f232db2e9b33ccaf92670c473613c))
* **proxy:** serve manifest.webmanifest + icon.svg without auth gating ([#16](https://github.com/refinarr/refinarr/issues/16)) ([1beeddd](https://github.com/refinarr/refinarr/commit/1beeddddc1cf6ac8c9f311e677e4367dcea8e714))
* QA Phase 4 — cron validation/health ([#23](https://github.com/refinarr/refinarr/issues/23)) + nonexistent-instance 404s ([#22](https://github.com/refinarr/refinarr/issues/22)) ([#25](https://github.com/refinarr/refinarr/issues/25)) ([2bc0b48](https://github.com/refinarr/refinarr/commit/2bc0b48d4cc0a8293544f3871fd3fabfbb3185a3))

## [0.5.4](https://github.com/refinarr/refinarr/compare/v0.5.3...v0.5.4) (2026-05-30)


### Bug Fixes

* **auth:** set session cookie Secure by transport, not NODE_ENV ([#13](https://github.com/refinarr/refinarr/issues/13)) ([b98dc71](https://github.com/refinarr/refinarr/commit/b98dc719769bc73b9e17cc65972494a2e1e568fd))

## [0.5.3](https://github.com/refinarr/refinarr/compare/v0.5.2...v0.5.3) (2026-05-30)


### Bug Fixes

* **docker:** chmod /data so a read-only bind mount can't break migrate ([209ab94](https://github.com/refinarr/refinarr/commit/209ab94109aec6425b0f2afa93471367b87e539f))
* **docker:** chmod /data so a read-only bind mount can't break migrate ([bf904bf](https://github.com/refinarr/refinarr/commit/bf904bf51b72957ae689a8aa90083a888706e471))

## [0.5.2](https://github.com/refinarr/refinarr/compare/v0.5.1...v0.5.2) (2026-05-30)


### Bug Fixes

* **docker:** make the production image build and boot end-to-end ([e28a178](https://github.com/refinarr/refinarr/commit/e28a1789a82c3d78af542a7101884944ac6a3f6f))
* **docker:** make the production image build and boot end-to-end ([57307be](https://github.com/refinarr/refinarr/commit/57307be5485a38a9237b00364241f1492d3eef29))
* **e2e:** build without standalone output so `next start` is supported ([e5a184a](https://github.com/refinarr/refinarr/commit/e5a184ac0a2513727ad4953e5db132b01c10e987))
* **e2e:** build without standalone output so `next start` is supported ([a125946](https://github.com/refinarr/refinarr/commit/a12594644d8545075dcb454727e3f732bdffb87a))


### Performance Improvements

* **docker:** shrink runtime image 493MB -&gt; 399MB ([56ffa1d](https://github.com/refinarr/refinarr/commit/56ffa1d5400e68099afac55efe9fdfe8ee8e2fea))

## [0.5.1](https://github.com/refinarr/refinarr/compare/v0.5.0...v0.5.1) (2026-05-30)


### Bug Fixes

* **docker:** install shadow so PUID/PGID entrypoint works on Alpine ([affac12](https://github.com/refinarr/refinarr/commit/affac1295008c36ae7feb6edaa2386f29244af5c))
* **docker:** install shadow so PUID/PGID entrypoint works on Alpine ([e4c390d](https://github.com/refinarr/refinarr/commit/e4c390d20918feda7082fe9cedc94e0b779a16e4))

## [0.5.0](https://github.com/refinarr/refinarr/compare/v0.4.2...v0.5.0) (2026-05-30)


### Miscellaneous Chores

* launch refinarr public OSS ([b96f570](https://github.com/refinarr/refinarr/commit/b96f570971e7893ce23bca3ea5818ccdc922d8e4))

## [0.4.2](https://github.com/iHX-Labs/refinarr/compare/v0.4.1...v0.4.2) (2026-05-30)


### Bug Fixes

* **ci:** apply Codex findings + drop docker-pr-build ([#186](https://github.com/iHX-Labs/refinarr/issues/186)) ([0050f8f](https://github.com/iHX-Labs/refinarr/commit/0050f8f5b5feb00c7223b6ec23fa66d73d718181))

## [0.4.1](https://github.com/iHX-Labs/refinarr/compare/v0.4.0...v0.4.1) (2026-05-30)


### Bug Fixes

* **deps:** bump @hookform/resolvers from 5.2.2 to 5.4.0 ([#182](https://github.com/iHX-Labs/refinarr/issues/182)) ([24d1842](https://github.com/iHX-Labs/refinarr/commit/24d18428ed1a39ba98543644c4508817ccd34994))
* **deps:** bump @tanstack/react-virtual in the tanstack group ([#180](https://github.com/iHX-Labs/refinarr/issues/180)) ([201a8ea](https://github.com/iHX-Labs/refinarr/commit/201a8eab6d0825b5f28ca7700e8cece4cc7abcd5))
* **deps:** bump next-intl from 4.12.0 to 4.13.0 in the next group ([#181](https://github.com/iHX-Labs/refinarr/issues/181)) ([15586dd](https://github.com/iHX-Labs/refinarr/commit/15586dd176e4ac8c19bb4d909f5c4c178492d6d1))
* **deps:** bump shadcn from 4.7.0 to 4.8.3 ([#183](https://github.com/iHX-Labs/refinarr/issues/183)) ([992eb4c](https://github.com/iHX-Labs/refinarr/commit/992eb4cc9d9325197a18271f79ea0230f0a8f262))

## [0.4.0](https://github.com/iHX-Labs/refinarr/compare/v0.3.1...v0.4.0) (2026-05-29)


### Features

* **ci:** use native ubuntu-24.04-arm runner for arm64 build ([#174](https://github.com/iHX-Labs/refinarr/issues/174)) ([2f8977b](https://github.com/iHX-Labs/refinarr/commit/2f8977bfcd46c3800cfa3d58cf580453efb6661f))

## [0.3.1](https://github.com/iHX-Labs/refinarr/compare/v0.3.0...v0.3.1) (2026-05-29)


### Bug Fixes

* **ci:** hardcode lowercase GHCR image name ([#172](https://github.com/iHX-Labs/refinarr/issues/172)) ([ee8b651](https://github.com/iHX-Labs/refinarr/commit/ee8b6514a8894c7e14eb5ce639661553a7f1ba1a))

## [0.3.0](https://github.com/iHX-Labs/refinarr/compare/v0.2.2...v0.3.0) (2026-05-29)


### Features

* /settings/system tab — build info + GitHub update check ([#90](https://github.com/iHX-Labs/refinarr/issues/90)) ([c20cb20](https://github.com/iHX-Labs/refinarr/commit/c20cb2023e581d4a5671f6547d3e460833ee2793))
* **a2:** de-cramp season actions + fill the media-header search gap ([#137](https://github.com/iHX-Labs/refinarr/issues/137)) ([c1a63f4](https://github.com/iHX-Labs/refinarr/commit/c1a63f4b59ffd38ee721ce944108e834f141d660))
* **a2:** tighten InstanceCard header — type icon + inline status dot ([#131](https://github.com/iHX-Labs/refinarr/issues/131)) ([c7a4520](https://github.com/iHX-Labs/refinarr/commit/c7a452050af7e2adb685558ee547fb9c162b1428))
* **a3:** remove combined Delete+Search action and legacy delete_blacklist ([#138](https://github.com/iHX-Labs/refinarr/issues/138)) ([e9c34fe](https://github.com/iHX-Labs/refinarr/commit/e9c34fe163c893be78596c23e50a5dcb15ae0ce5))
* add refresh functionality for instances and improve caching ([6b70bd5](https://github.com/iHX-Labs/refinarr/commit/6b70bd529b42ab051ca8cc299fd287c286722ed7))
* **auto-runner:** order picker by signed score + missing-file priori… ([#92](https://github.com/iHX-Labs/refinarr/issues/92)) ([2b03852](https://github.com/iHX-Labs/refinarr/commit/2b03852b701c6806f9fd5886752a2c54478afc83))
* **auto-search:** observability — overdue + failed-streak red + async stop() drain ([#81](https://github.com/iHX-Labs/refinarr/issues/81)) ([640fb5d](https://github.com/iHX-Labs/refinarr/commit/640fb5d10b3c6d79e4b9962b6e19e32726f3a2ec))
* **auto-search:** per-instance scheduled auto-search ([32b6833](https://github.com/iHX-Labs/refinarr/commit/32b6833e235abdeff95995939aadd2affd7d9bca))
* **auto-search:** per-instance scheduled auto-search ([384512e](https://github.com/iHX-Labs/refinarr/commit/384512ebbdad9c847a20bff242e9d41866c055a0))
* **auto-search:** phase 2 — cooldown, pause-until, fleet panel, scoring mode override ([7e2932b](https://github.com/iHX-Labs/refinarr/commit/7e2932ba782fca8e06d1760644993ea9fd355e63))
* **auto-search:** phase 2 — cooldown, pause-until, fleet panel, scoring override ([983dff9](https://github.com/iHX-Labs/refinarr/commit/983dff92a1fb33808c510677c784ce7c6ecaf16a))
* bounded LRU dataCache + /settings/diagnostics page ([#89](https://github.com/iHX-Labs/refinarr/issues/89)) ([18597b6](https://github.com/iHX-Labs/refinarr/commit/18597b6e60fd97958880c2174cbe90fbb56c0250))
* brand identity, three themes, code-smell tooling ([fc0f19e](https://github.com/iHX-Labs/refinarr/commit/fc0f19eec38335e5309bcd82f340624bb8735ff5))
* **brand:** logo, three themes, centralized color palette ([1867add](https://github.com/iHX-Labs/refinarr/commit/1867add1d7a8909403711f41e7ed95b41750d4ff))
* **brand:** replace placeholder logo with designed refinarr wordmark ([#149](https://github.com/iHX-Labs/refinarr/issues/149)) ([9663ec6](https://github.com/iHX-Labs/refinarr/commit/9663ec64f1b3bf18ab2ba9c9710c964acacc59fc))
* **bulk:** multi-instance "All Radarr"/"All Sonarr" + Cancel button ([723793a](https://github.com/iHX-Labs/refinarr/commit/723793adb9f951dcfda0a3aa58e1d6a158b7844c))
* **bulk:** per-item progress UI for bulk actions via runSerial ([a3b712c](https://github.com/iHX-Labs/refinarr/commit/a3b712ce8ebb45778d400458548c3da9f467af64))
* **common:** scroll-to-top button for media lists (desktop + mobile) ([#146](https://github.com/iHX-Labs/refinarr/issues/146)) ([856c913](https://github.com/iHX-Labs/refinarr/commit/856c9138f249f56a0967072072f0007e5a4936bc))
* enhance ESLint configuration and improve state management in hooks ([6448c9c](https://github.com/iHX-Labs/refinarr/commit/6448c9c812ecb02e9aefb969bad08e5834bc9466))
* enhance series and movie management features ([049c119](https://github.com/iHX-Labs/refinarr/commit/049c11948025e1c71afabb4f0b4913b64abf879b))
* **forms:** FormField helper with aria wiring + spinner on submits ([01c1748](https://github.com/iHX-Labs/refinarr/commit/01c1748436114bfeeacd71b1b825b64cb8729f53))
* **gitignore:** add .claude directory to ignore list ([293bb5e](https://github.com/iHX-Labs/refinarr/commit/293bb5e4efd628df3e38154329aff5cbe8304d2d))
* **history-deeplink:** clickable titles in history + dashboard ([#94](https://github.com/iHX-Labs/refinarr/issues/94)) ([1161afb](https://github.com/iHX-Labs/refinarr/commit/1161afbbf3149d94a1eccd8ddcf295e9551aecdd))
* **history:** batch grouping + per-item commandId + pending-row synthesis ([0016104](https://github.com/iHX-Labs/refinarr/commit/00161043c313624eb81c2ec8bdf652917980fc88))
* **history:** batch grouping + per-item commandId + pending-row synthesis ([576cd16](https://github.com/iHX-Labs/refinarr/commit/576cd16a80d48e8ec932597dd19d15779c56b137))
* **history:** server-side groupSummaries — accurate batch totals across pages ([#82](https://github.com/iHX-Labs/refinarr/issues/82)) ([6e38237](https://github.com/iHX-Labs/refinarr/commit/6e382370a45414ea7c04cc2af25804cdc2b16d50))
* **i18n:** integrate next-intl for toast messages in useRefreshInstance and useShowsPage hooks ([e4634c6](https://github.com/iHX-Labs/refinarr/commit/e4634c61606df1119868e4b6543cce50a0eadf27))
* **i18n:** move format-relative strings into "time" namespace + fix Math.floor ([894b5b2](https://github.com/iHX-Labs/refinarr/commit/894b5b2280d839f65f4a2f3f600c1143b5188d68))
* implement API key management in settings ([70db1c2](https://github.com/iHX-Labs/refinarr/commit/70db1c2764cda826d2617b4a97d6bc881bfd223e))
* **instances:** per-instance "Advanced — show all media" toggle ([b3a5a41](https://github.com/iHX-Labs/refinarr/commit/b3a5a4103af5330a18d6fb05574b7d03c66ec5cf))
* **instances:** per-instance Show-all-media toggle ([ee8dfe1](https://github.com/iHX-Labs/refinarr/commit/ee8dfe1a9f39b022d04cd49f686c5c4e7be24921))
* **instances:** smart URL normalization and type-aware placeholders ([5c94a8f](https://github.com/iHX-Labs/refinarr/commit/5c94a8f675cac4a6a3cecbd4b4bf8894230a4be1))
* **layout:** mobile bottom tab bar + form-control sizing tokens ([9217f40](https://github.com/iHX-Labs/refinarr/commit/9217f4079b0363a5ef8f78321612d69090a84b12))
* **layout:** mobile bottom tab bar + form-control sizing tokens ([470f3a6](https://github.com/iHX-Labs/refinarr/commit/470f3a68e3abfc2345ff86bed88d044466da391b))
* **layout:** mobile shell foundation — Topbar, NavContent, skip link ([cf84fd0](https://github.com/iHX-Labs/refinarr/commit/cf84fd0d90bde834357de99402dea4e57e867a71))
* logs phase 3 — detail panel, URL-synced filters, instanceId column ([#88](https://github.com/iHX-Labs/refinarr/issues/88)) ([461fbff](https://github.com/iHX-Labs/refinarr/commit/461fbff4acd4a7bbc837a45bf6c1badeecdb633d))
* **logs:** add title + instance name to media-action log lines ([803cf43](https://github.com/iHX-Labs/refinarr/commit/803cf43668f33b58cfb12ef19461524b2cafd4f0))
* **logs:** add title + instance name to media-action log lines ([be5d48e](https://github.com/iHX-Labs/refinarr/commit/be5d48e50482d8dc38c5c3dc6ccef7e31ade266f))
* **logs:** implement application logging page with filtering and clearing functionality ([2eee1d6](https://github.com/iHX-Labs/refinarr/commit/2eee1d602cc21af98b3c4bbba4120b54a89582d3))
* **logs:** source filter + debug mode; cron presets; auto-search badge on dashboard ([6eebd0c](https://github.com/iHX-Labs/refinarr/commit/6eebd0cf6c86971b7c5bc0a87a78a3ec9d79164d))
* **media-filters:** integrate show-all setting into media filters logic ([b0e4634](https://github.com/iHX-Labs/refinarr/commit/b0e4634c83f35af95df812ab0a3ccb59e164068d))
* **media:** add MediaListShell shared shell component ([b677edc](https://github.com/iHX-Labs/refinarr/commit/b677edc670631fc8f12246b842dcb92057d4d5cc))
* **media:** banner header + multi-select CF filters with AND/OR toggle ([7cc0c4f](https://github.com/iHX-Labs/refinarr/commit/7cc0c4f0b4ba5bd8ebf77053ee8c8d3e2cc5887b))
* **media:** mobile card variant for MediaTable via renderCard prop ([a401ab6](https://github.com/iHX-Labs/refinarr/commit/a401ab6efb591609e847060ddd303fd7c540e47c))
* **media:** mobile filter sheet and fixed-bottom bulk toolbar ([4d29cfa](https://github.com/iHX-Labs/refinarr/commit/4d29cfa403290f73a2a51607b037c028a3dd025b))
* **media:** mobile filter toolbar + Filters sheet ([3cb1360](https://github.com/iHX-Labs/refinarr/commit/3cb13600d6e92e6b22b886ce4b43b1b51042f124))
* **media:** per-column filter funnel for the Custom Formats column ([a81a673](https://github.com/iHX-Labs/refinarr/commit/a81a6738ad5721493c89a419d72dc5637012ac16))
* **media:** per-column filter funnels (CF, severity, profile, score, size) ([705f5ea](https://github.com/iHX-Labs/refinarr/commit/705f5ea5e15e05a9114770787df95b7bdf8805f0))
* **media:** per-column funnels for severity, profile, score, size ([73fc424](https://github.com/iHX-Labs/refinarr/commit/73fc42464c1dfc85430b3960ae3364e6bfde5b8e))
* **media:** show quality profile in detail drawers ([70b6ee4](https://github.com/iHX-Labs/refinarr/commit/70b6ee4f8e464f0870a4e6ef3f34ad84fbf497e6))
* **mobile:** instance switcher on Movies/Shows tabs (qui-style) ([#95](https://github.com/iHX-Labs/refinarr/issues/95)) ([45019ec](https://github.com/iHX-Labs/refinarr/commit/45019ec842d53e0b254d94b1625a68e604ae7cd5))
* **queue:** search queue + per-row status + cross-tab SSE ([26da366](https://github.com/iHX-Labs/refinarr/commit/26da3660618765f3ca4026ddb15bd95a4c459946))
* **queue:** search queue + per-row status + cross-tab SSE ([31580d0](https://github.com/iHX-Labs/refinarr/commit/31580d05e224a387482a068ebfdcce5d78a6089f))
* **queue:** search queue stability, per-row badges, and dev housekeeping ([792d738](https://github.com/iHX-Labs/refinarr/commit/792d738a09b89ae75a71a21d0f855412768b2e6d))
* **rate-limiter:** AbortSignal support, iteration cap, timer leak fix ([daed0f2](https://github.com/iHX-Labs/refinarr/commit/daed0f2241b7a5c33f592e1138b22d28a8dcee3f))
* **rate-limit:** per-instance token bucket + fix CodeRabbit leftover ([02c1e9f](https://github.com/iHX-Labs/refinarr/commit/02c1e9f5bbb6262b77ce2ef8076d7ae362e312f3))
* **rate-limit:** per-instance token bucket for outbound *arr API calls ([fc849d6](https://github.com/iHX-Labs/refinarr/commit/fc849d6a5fa962cf69c00d4b0a9d3d035273774f))
* Refactor queue management and theme handling ([9b7ad94](https://github.com/iHX-Labs/refinarr/commit/9b7ad94b43361c4840a19786c1c0a88809e6b169))
* **schema:** promote scoringMode from AppConfig key to Instance column ([fdde0de](https://github.com/iHX-Labs/refinarr/commit/fdde0de77ab1b0fe6d81e9806ff35f72511302d8))
* **schema:** promote scoringMode to Instance column + plan docs ([6fdf6b7](https://github.com/iHX-Labs/refinarr/commit/6fdf6b7c190e3b39b2a024ae05de763457f3afcf))
* **settings:** close out Phase 2 §A — connection dot + Delete kebab + confirm ([b4b0425](https://github.com/iHX-Labs/refinarr/commit/b4b04252a415ea451b4abaeae2a216999a787f80))
* **settings:** pageHeader pins on desktop too + scroll-spy hardening ([134c201](https://github.com/iHX-Labs/refinarr/commit/134c2016ba0016e8fd1bf5aa76b2db26ffed06c0))
* **settings:** promote dry-run, scroll-to-anchor from cmdk, test before save ([eb68ef2](https://github.com/iHX-Labs/refinarr/commit/eb68ef2f39ce7a5cfd3efb1aff4ba73deb5d45da))
* **settings:** rail nav + mobile picker + iOS-friendly scroll lock ([7693f6f](https://github.com/iHX-Labs/refinarr/commit/7693f6f966768a7787800f8e4c8478642be2de1b))
* **settings:** rail nav + mobile picker + iOS-friendly scroll lock ([ad91014](https://github.com/iHX-Labs/refinarr/commit/ad91014e92ae32846b08b371fabed5214df55b62))
* **settings:** reorder rail (operational &gt; cosmetic &gt; admin &gt; auth &gt; dev) ([#147](https://github.com/iHX-Labs/refinarr/issues/147)) ([6f4ea28](https://github.com/iHX-Labs/refinarr/commit/6f4ea28f6157e57c5f1103823be115e14e929116))
* **settings:** split into per-section Next.js routes — drop the scroll-spy page ([1b93900](https://github.com/iHX-Labs/refinarr/commit/1b939009b8dff9642ffe0ee8ffe791161eb09902))
* **states:** KpiCardSkeleton and SettingsCardSkeleton ([a0a8288](https://github.com/iHX-Labs/refinarr/commit/a0a8288c2b8976c5767c776c16c511718fd2fdc6))
* **status-poller:** poll /command + /history to drive ActionLog lifecycle ([a58d211](https://github.com/iHX-Labs/refinarr/commit/a58d211ee4231cdb38fcdc868b63c50ca1ce9215))
* **status-poller:** poll /command + /history to drive ActionLog lifecycle ([86edaa7](https://github.com/iHX-Labs/refinarr/commit/86edaa78d99cd978e50057831a6d3496e27eec86))
* **tests:** add comprehensive tests for SeriesService and setup testing environment ([9d458d2](https://github.com/iHX-Labs/refinarr/commit/9d458d2bf7c81c214128a2038b389c6e91c417fa))
* **tests:** add integration tests for API endpoints and hooks ([fc8eefa](https://github.com/iHX-Labs/refinarr/commit/fc8eefa09a6fbfc21a24e831f4ae05656785f32b))
* **theme:** implement new theming system with surface variables and … ([22f1edd](https://github.com/iHX-Labs/refinarr/commit/22f1edd3c2de1dc845e6b7fab38fa0132eff1ba0))
* **theme:** implement new theming system with surface variables and brand support ([94ea567](https://github.com/iHX-Labs/refinarr/commit/94ea567e81784fc49270ed495aa014504346da3e))
* **ui:** add Monitored column + stable sort caret ([4972565](https://github.com/iHX-Labs/refinarr/commit/49725655652ab8f688672c127c9a062fd307a2ac))
* **ui:** grid layout, uniform rows, density toggle, sticky header ([aa34679](https://github.com/iHX-Labs/refinarr/commit/aa346798f5aa59b5dc99cade7781c10109d11d69))
* **ui:** Movies/Series Phase 1 polish — Monitored col, density, virt, grid layout ([41977dd](https://github.com/iHX-Labs/refinarr/commit/41977dd11a615c8fd9d6911d716260df0e4c31b4))
* **ui:** refresh skeleton + add useDensity tests ([ee245b3](https://github.com/iHX-Labs/refinarr/commit/ee245b322809609a60fb325a67c427b684722e24))
* **ui:** Settings page Phase 2 polish ([4987cc9](https://github.com/iHX-Labs/refinarr/commit/4987cc91058a012332004b55e81aea2a326ea5c1))
* **ui:** Settings page Phase 2 polish — sticky h2, card collapse, rail refresh ([06f1026](https://github.com/iHX-Labs/refinarr/commit/06f1026877e7e6163adf6ba8b8923a7b3f6d3707))
* **ui:** settings polish + media page header + multi-select CF filters ([a4100be](https://github.com/iHX-Labs/refinarr/commit/a4100be0bd07bbaffe4bc5a77d43b44114f5ce88))
* **ui:** virtualize MediaTable rows with @tanstack/react-virtual ([d7b970d](https://github.com/iHX-Labs/refinarr/commit/d7b970d0189c146ff748e63c7ac413ea1e32ca21))
* **v2:** Phase 1 — mobile shell, responsive tables, form polish ([ae0177c](https://github.com/iHX-Labs/refinarr/commit/ae0177c62119eaba5967cdedd085777599fe13bb))
* **v2:** Phase 2A — bulk-op per-item progress ([a487790](https://github.com/iHX-Labs/refinarr/commit/a487790c679a8a747517b0dda962c3a6276b3de5))
* **v2:** Phase 2B — multi-instance bulk + Cancel button + page-hook split ([bb3da61](https://github.com/iHX-Labs/refinarr/commit/bb3da6172ab17732035974e38a2877c1430eff0b))
* **v2:** Phase 3 — ⌘K command palette + keyboard help dialog ([f10f29b](https://github.com/iHX-Labs/refinarr/commit/f10f29b0f5feea7c234b85167e6c37a61819da80))
* **v2:** Phase 3 — ⌘K command palette + keyboard help dialog ([cbfb2a2](https://github.com/iHX-Labs/refinarr/commit/cbfb2a2ea9adfde30bd74f07e14d9a2da2b5aaf8))


### Bug Fixes

* **actions:** tighten ActionType discriminator after CodeRabbit review ([cee5463](https://github.com/iHX-Labs/refinarr/commit/cee5463fc7ee6fa020fee2eb09135070f2098799))
* **actions:** validate retry payloads + handle new actions in history filter ([fb45153](https://github.com/iHX-Labs/refinarr/commit/fb451532411bb81ad48f31f20a8b98429e2d9349))
* address CodeRabbit review comments on phase-2 auto-search ([4a20898](https://github.com/iHX-Labs/refinarr/commit/4a20898718c946e535a2db66d6b2dc5cf9c87325))
* address mobile layout review feedback ([3f71db2](https://github.com/iHX-Labs/refinarr/commit/3f71db22dc88a3ba8fbf93e55e513a9c5092c573))
* address PR review — i18n type safety, shuffle, ETA, stale state ([48d39e0](https://github.com/iHX-Labs/refinarr/commit/48d39e0d8ec0cb2ef6c7301fec5f7325de0d3130))
* address PR review — msUntil NaN guard, remove test cast ([5cb7768](https://github.com/iHX-Labs/refinarr/commit/5cb77685ce0c9dee517375e4604fb69e3ba0f3f4))
* address PR review — signal composition, stale-path failures, cooldown tests ([6635121](https://github.com/iHX-Labs/refinarr/commit/663512172aa934b719983053133817696c485260))
* address remaining CodeRabbit comments on phase-2 auto-search ([0e6cd14](https://github.com/iHX-Labs/refinarr/commit/0e6cd14dc2dca68669575efd6f21d1fbf8a23710))
* address remaining CodeRabbit comments on phase-2 auto-search ([35ba924](https://github.com/iHX-Labs/refinarr/commit/35ba924c4e73447483b9254364224b5afeabcdab))
* address remaining CodeRabbit majors on PR [#27](https://github.com/iHX-Labs/refinarr/issues/27) ([6d7292c](https://github.com/iHX-Labs/refinarr/commit/6d7292c3d2dedc9019b47f4ae27aa35393b02701))
* address second round of PR review comments ([b187611](https://github.com/iHX-Labs/refinarr/commit/b187611da139210e41b21602847918cdee13162c))
* address second round of PR review comments ([e464187](https://github.com/iHX-Labs/refinarr/commit/e464187d55b59d8f191ce054b0936ed2e2231955))
* address theme review follow-ups ([1e6970e](https://github.com/iHX-Labs/refinarr/commit/1e6970e09e3bf05f1236be558a76734a4b1a22d0))
* address third round of PR review comments ([20f2b80](https://github.com/iHX-Labs/refinarr/commit/20f2b80d6eee95019cf59e1b9fde713c93936a6d))
* align show-all media filter defaults ([69e942c](https://github.com/iHX-Labs/refinarr/commit/69e942cdb2f24b6b1ac527ba90edd6f00e028203))
* **api:** auto-invalidate flagged-media cache on config and instance writes ([e744301](https://github.com/iHX-Labs/refinarr/commit/e744301144e4ea4596200e52f126d9302962501e))
* **apiFetch:** improve error reporting structure for API response errors ([a602937](https://github.com/iHX-Labs/refinarr/commit/a602937b9f0eab84d47a436fe655f2c69fc7c553))
* **arr-client:** add 10s timeout to every upstream fetch ([8951c97](https://github.com/iHX-Labs/refinarr/commit/8951c97c45fa132576aed519067f73e5eba52251))
* **arr-client:** add 10s timeout to every upstream fetch ([c72f522](https://github.com/iHX-Labs/refinarr/commit/c72f5221e5520f59344dc829c6ccce513f3a4a94))
* **arr-client:** unwrap fetch error cause for actionable failure reason ([97f632e](https://github.com/iHX-Labs/refinarr/commit/97f632e9ee98f0ac8969da37886247e9d81df864))
* **arr:** runtime type guards on concrete-client construction ([#84](https://github.com/iHX-Labs/refinarr/issues/84)) ([267f94b](https://github.com/iHX-Labs/refinarr/commit/267f94b6ab24eb1e0e52dff90b251303dcfb08f1))
* **auth:** SubmitEvent type + structured same-as-current error code ([d1b72f4](https://github.com/iHX-Labs/refinarr/commit/d1b72f4616bc4651e01546f80d8f4c1b7d1f0c28))
* **auto-search:** address CodeRabbit review comments ([a0dcd98](https://github.com/iHX-Labs/refinarr/commit/a0dcd988a57e71285f8c1e3c1bfbb197dca773ac))
* **auto-search:** resolve react-hooks/purity warning in AutoSearchSection ([857d84b](https://github.com/iHX-Labs/refinarr/commit/857d84bf02190b83c54da305417d8fc466fcb991))
* **bulk:** use selectedItem in drawer callbacks instead of narrowed param ([3831cf3](https://github.com/iHX-Labs/refinarr/commit/3831cf382f08ff96811ed20551aa08bb11f86a02))
* **ci:** drop bump-patch-for-minor-pre-major from release-please config ([#153](https://github.com/iHX-Labs/refinarr/issues/153)) ([af7b088](https://github.com/iHX-Labs/refinarr/commit/af7b088c7b72c034d8016d541125db7d2e2d999f))
* **ci:** make release-image workflow_dispatch accept tag input ([#159](https://github.com/iHX-Labs/refinarr/issues/159)) ([3f7e99d](https://github.com/iHX-Labs/refinarr/commit/3f7e99d01aec7160bc5ab2385a6e5480fa2ecc29))
* **ci:** matrix-build release image per arch in parallel ([#170](https://github.com/iHX-Labs/refinarr/issues/170)) ([8226b71](https://github.com/iHX-Labs/refinarr/commit/8226b71ce8506ffb60abe6323de5c4b88385f5a5))
* **client-error-logger:** include stack + status=0 on network failures ([8c13d94](https://github.com/iHX-Labs/refinarr/commit/8c13d94465d6a63c22d3184bab2d86e4444ea9b4))
* **cron:** input auto-format, sanitization, [@alias](https://github.com/alias) support, UX hints ([a66e01b](https://github.com/iHX-Labs/refinarr/commit/a66e01b82df18da4a0441151a92d68367a85f8c9))
* **dashboard:** preserve unknown semantics in aggregated totals ([0384f67](https://github.com/iHX-Labs/refinarr/commit/0384f670f4be46621a460bc672c3f37a9a3fb3ce))
* **dashboard:** update badge display logic based on config.dryRun state ([1ae1ff5](https://github.com/iHX-Labs/refinarr/commit/1ae1ff5d8a3acd618141f1384f51e2ea8a3b33b2))
* **dashboard:** update badge display logic based on config.dryRun state ([e62aece](https://github.com/iHX-Labs/refinarr/commit/e62aece88332eea63a8bc9f1fd132d1cb589e43f))
* **docker:** bundle Prisma CLI so migrate deploy needs no internet access ([f5bb813](https://github.com/iHX-Labs/refinarr/commit/f5bb813f78ce0b397a3166844461e5726815ea22))
* **docker:** bundle Prisma CLI so migrate deploy needs no internet access ([29b9201](https://github.com/iHX-Labs/refinarr/commit/29b92019d8c334afaabf13734925f40043fcc179))
* **docker:** copy prisma/ before yarn install in deps stage ([#161](https://github.com/iHX-Labs/refinarr/issues/161)) ([b3a027d](https://github.com/iHX-Labs/refinarr/commit/b3a027d0fd7cf94d3d00b3e30887b3538062c926))
* **e2e:** align Playwright specs with current DOM + selection model ([fbaa8b3](https://github.com/iHX-Labs/refinarr/commit/fbaa8b36288f6cd733a6fdd34b93dd066d6a4669))
* **e2e:** instances delete flow goes through kebab + confirm dialog ([5ff07ac](https://github.com/iHX-Labs/refinarr/commit/5ff07ac1466060c1de8531f49f36a24ee6239b54))
* **e2e:** migrate before next start to close globalSetup race ([e18f3e2](https://github.com/iHX-Labs/refinarr/commit/e18f3e25fafb5e022b32d706d2af159991355723))
* **e2e:** migrate in webServer command to close globalSetup race ([eba59d8](https://github.com/iHX-Labs/refinarr/commit/eba59d882a5c780b13f8be8499ee702c1509cd6a))
* **e2e:** migrate in webServer command to close globalSetup race ([b865472](https://github.com/iHX-Labs/refinarr/commit/b865472bda60c942f2ef54f2f1eb59632d318568))
* **history:** address CodeRabbit feedback — composite index, redundant casts, keyboard a11y ([6ecb0a6](https://github.com/iHX-Labs/refinarr/commit/6ecb0a63369f46c9f3e40810be0b71495ee62314))
* **history:** drop RetryNotSupportedError, fix recent-search ranking, add index ([39f2732](https://github.com/iHX-Labs/refinarr/commit/39f2732e74cb8c90a82d63ee887c582a334da5b1))
* **history:** guard retry against payload/row mismatch + MSW for tests ([46b3bf9](https://github.com/iHX-Labs/refinarr/commit/46b3bf9e7b292f370fc65b87d5b19ea3e903c6c5))
* **history:** make findRecentSearches order deterministic ([b2df7b0](https://github.com/iHX-Labs/refinarr/commit/b2df7b0ae1d68f0145723c511e755bb5b0edab76))
* **history:** normalize movie delete payload action to match column ([a6bf40e](https://github.com/iHX-Labs/refinarr/commit/a6bf40e75270278250fd04b0417a4c9edee1b813))
* **history:** preserve season/episode-file scope on retry ([3f0cee2](https://github.com/iHX-Labs/refinarr/commit/3f0cee2d9d108852411ebc185fcb4f563086627a))
* **history:** require action parity in retry payload guard + tighten comment ([074847c](https://github.com/iHX-Labs/refinarr/commit/074847c09826883bdbcdd48141b70f7b6f2f6d66))
* **history:** retry updates the existing row instead of creating a duplicate ([2d38475](https://github.com/iHX-Labs/refinarr/commit/2d38475900754bacbdb6fc94a0da069a57508cbb))
* **history:** retry updates the existing row instead of creating a duplicate ([5620c92](https://github.com/iHX-Labs/refinarr/commit/5620c9298c89af2ad698cb613dfcd98c2bf48166))
* **i18n:** ICU plurals for queue count strings ([e1e207f](https://github.com/iHX-Labs/refinarr/commit/e1e207fccda4759453dc567c8e9dad5144c8c476))
* **instance-service:** catch refresh-promise rejections ([ed17f0b](https://github.com/iHX-Labs/refinarr/commit/ed17f0bf78337f7ec6c7c7bfd1cc4d5c1f680c4a))
* **instance-service:** include failure reason in Connection/Credentials test error logs ([accc566](https://github.com/iHX-Labs/refinarr/commit/accc566c6d935c041e629265a5e5560d63c74be7))
* **instance-service:** log connection test failures at error level ([7d4afb9](https://github.com/iHX-Labs/refinarr/commit/7d4afb9971c0236ad9ca27f35f1233a6ead0d586))
* **layout:** address PR-52 CodeRabbit feedback + repair mobile e2e ([f6e4538](https://github.com/iHX-Labs/refinarr/commit/f6e453894e9e2464c24684c4d132bb499c6b5554))
* **layout:** update MobileTabBar active state logic for nested routes ([d4d7b46](https://github.com/iHX-Labs/refinarr/commit/d4d7b46b1f7e4c670f816ab5e03df731c9db7fcf))
* **lint:** resolve all eslint warnings in phase-2 auto-search files ([79995b1](https://github.com/iHX-Labs/refinarr/commit/79995b14f51c0e550118ad0a763e02d5067ef40f))
* **media-service:** stop skeleton loop after upstream timeout ([2ba82eb](https://github.com/iHX-Labs/refinarr/commit/2ba82eb18e99a729ea779cf153d5ee791625d9ab))
* **media:** address PR-53 CodeRabbit feedback ([de3d82f](https://github.com/iHX-Labs/refinarr/commit/de3d82fb7c84d6d55450bafbd150898abb96bfaf))
* **media:** address PR-53 round-3 CodeRabbit feedback ([32daa83](https://github.com/iHX-Labs/refinarr/commit/32daa832b14286d413fbe8d54eced7a2b7a3fa57))
* **media:** Codex review batch — memo correctness + virt fixes + sort cycle ([dcfb16d](https://github.com/iHX-Labs/refinarr/commit/dcfb16de316ece5b66801890efaeb06a8816253f))
* **media:** don't apply maxScore filter in profile mode ([c72fbfa](https://github.com/iHX-Labs/refinarr/commit/c72fbfa7020f5d0c87ceab67f76220c11ee7b06b))
* **media:** e2e + CodeRabbit + filter-hook DRY ([82bb301](https://github.com/iHX-Labs/refinarr/commit/82bb3011df57c21771b3a681cdb80ff9d2dee154))
* **media:** humanize score/size chip labels + i18n a11y aria-labels ([4c7f5e8](https://github.com/iHX-Labs/refinarr/commit/4c7f5e88fcf2e513f7551dd1518cab667ee35e2a))
* **media:** invalidate flagged-media cache on successful action ([43230b6](https://github.com/iHX-Labs/refinarr/commit/43230b63ca074f286face0147f72691646e74b37))
* **media:** invalidate flagged-media cache on successful action ([b5e0875](https://github.com/iHX-Labs/refinarr/commit/b5e08756aa66938918c70bfb00e9d325f09d5ed8))
* **media:** mobile bottom chrome — anchored bulk bar, capture-phase scroll, no reserved padding ([611548e](https://github.com/iHX-Labs/refinarr/commit/611548e841701fe889fa9f0157e55aa9efda23f5))
* **media:** useColumnSizing rehydrates on storageKey swap; MediaTable warns on virt/row-model misalignment ([3e94034](https://github.com/iHX-Labs/refinarr/commit/3e94034b4312870aaa99ef6f111dfa87620590d4))
* **n16:** validate instance + assert arr type in movies/series GET routes ([#121](https://github.com/iHX-Labs/refinarr/issues/121)) ([6598783](https://github.com/iHX-Labs/refinarr/commit/6598783ce1102b3fb573d375b2ea78c506cf332f))
* **oss-blockers:** cross-layer ServerEvent import + unvalidated instanceId ([#97](https://github.com/iHX-Labs/refinarr/issues/97)) ([bb7b62f](https://github.com/iHX-Labs/refinarr/commit/bb7b62fe3cae13f4c8c2dcfcaf9e4eb06bacc650))
* **oss-h1:** standardize wire contract — traceId + structured codes ([#98](https://github.com/iHX-Labs/refinarr/issues/98)) ([062a2a6](https://github.com/iHX-Labs/refinarr/commit/062a2a660f1dbb9e52af193a6ece6952fb2b0cae))
* **oss-h3:** redact array recursion + reserved keys; url-guard Oracle Cloud + IPv6 metadata ([#100](https://github.com/iHX-Labs/refinarr/issues/100)) ([6ae38ac](https://github.com/iHX-Labs/refinarr/commit/6ae38acb88bf3c750400939d676ff8227b3aa16f))
* **oss-h4:** LogLevelBadge i18n + JsonView Props interfaces ([#118](https://github.com/iHX-Labs/refinarr/issues/118)) ([8ca4589](https://github.com/iHX-Labs/refinarr/commit/8ca45894ab975d148f1390d1751604d488c9d49c))
* prevent stale cache rebuild writes ([6be5ce6](https://github.com/iHX-Labs/refinarr/commit/6be5ce692aacdd923489d50217f0fac136641d6a))
* **proxy:** drop `export const runtime = "nodejs"` (disallowed in Next.js 16 Proxy) ([4bbe1c9](https://github.com/iHX-Labs/refinarr/commit/4bbe1c93922c9ec75ae91f2488b4daae385504a1))
* **queue:** address CodeRabbit findings across queue, SSE, and settings ([d7cedc4](https://github.com/iHX-Labs/refinarr/commit/d7cedc4a9a6257ee70931888c8080869a833e177))
* **queue:** address three CodeRabbit findings ([951a56b](https://github.com/iHX-Labs/refinarr/commit/951a56b190f6c7e9cf05ce0c70c8dfc9283d2c51))
* **rate-limit:** FIFO queue, fractional rate, concurrent-waiter test ([769ad18](https://github.com/iHX-Labs/refinarr/commit/769ad18afe74935acdf491f0e52bdc307261301c))
* **rate-limit:** guard against NaN when ARR_RATE_LIMIT is non-numeric ([99882b8](https://github.com/iHX-Labs/refinarr/commit/99882b8ab9c1e652b81b761c0a6bba830a20f2b4))
* resolve tsc and lint issues in AutoSearchSection tests ([27ed462](https://github.com/iHX-Labs/refinarr/commit/27ed462dfb159a02a0a3f00cccacc4adbcb3d8c6))
* route mutation toasts through helper ([e1de04b](https://github.com/iHX-Labs/refinarr/commit/e1de04b64a1fdf77b2de25aa9b5b26ca1fa1dc8c))
* **route:** improve cursor validation for SSE connections ([6012379](https://github.com/iHX-Labs/refinarr/commit/6012379a8a133e06df56265dcbce541251a0e6ca))
* **scroll-to-top:** defer portal until after hydration ([#148](https://github.com/iHX-Labs/refinarr/issues/148)) ([8956bf9](https://github.com/iHX-Labs/refinarr/commit/8956bf930501efc5cf4f80349a32c153b6d0662c))
* **search-dispatcher:** address CodeRabbit review comments ([e862420](https://github.com/iHX-Labs/refinarr/commit/e8624207bcb480e95e3317599fece75fccdb90d4))
* **server:** runtime-check withClient against the expected ArrClient subclass ([61cb9be](https://github.com/iHX-Labs/refinarr/commit/61cb9be7fd1e10c0832d4ee0ea9959948f533bf3))
* **server:** tighten parseMediaQuery against CodeRabbit follow-up ([13fa28e](https://github.com/iHX-Labs/refinarr/commit/13fa28ee3f093e7a0db3941426ba70e148e59ca7))
* **server:** withClient takes arr-type discriminator instead of subclass constructor ([95c741b](https://github.com/iHX-Labs/refinarr/commit/95c741bee5af4262b7189ce67b079d33d3e090a3))
* **services:** drop cache-build logs to debug level ([c079b76](https://github.com/iHX-Labs/refinarr/commit/c079b7682dc103813451667f242e887c4383917c))
* **settings:** address PR-51 CodeRabbit feedback ([054b65c](https://github.com/iHX-Labs/refinarr/commit/054b65cb83aa929ddfa5d646101534b39322bec3))
* **status-poller:** fetch aged-out commands per-id ([#91](https://github.com/iHX-Labs/refinarr/issues/91)) ([8e971e1](https://github.com/iHX-Labs/refinarr/commit/8e971e11f90fa6e790bb49e2ffbf661a0c206160))
* **status-poller:** overlap window for /history indexing lag ([#93](https://github.com/iHX-Labs/refinarr/issues/93)) ([1d3a94b](https://github.com/iHX-Labs/refinarr/commit/1d3a94b076aa204694079b790ce208d3c04edf19))
* **test:** reorder useFlaggedMediaData test imports ([73a074e](https://github.com/iHX-Labs/refinarr/commit/73a074e45f0d09d51417fa2c1b66b41060360654))
* **tests:** exercise both scoringMode branches to keep coverage &gt;= 85% ([60342e4](https://github.com/iHX-Labs/refinarr/commit/60342e4fa14dc5cab3d1b8a119c33b389cb300ac))
* **toast:** drop English fallbacks; guard scoring-mode select value ([df4ee21](https://github.com/iHX-Labs/refinarr/commit/df4ee21f8c69a7d0df80ac27ff255acdfd57b8c1))
* **ui:** address CodeRabbit review on PR [#70](https://github.com/iHX-Labs/refinarr/issues/70) ([adb9b4b](https://github.com/iHX-Labs/refinarr/commit/adb9b4b8df2a0fcd3ff65b20ff99c0de54d306a5))
* **ui:** address PR [#71](https://github.com/iHX-Labs/refinarr/issues/71) CR + match Settings header style + History subtitle ([8ddfb47](https://github.com/iHX-Labs/refinarr/commit/8ddfb474064720a7d4487673652ffe58f1ec0e32))
* **ui:** BulkActionToolbar uses size variant instead of className size override ([d9b893f](https://github.com/iHX-Labs/refinarr/commit/d9b893f610e9e6a290c2e1f915b0cfec080ddb00))
* **ui:** bump MediaTable virt overscan to mask fast-scroll blank ([031fc03](https://github.com/iHX-Labs/refinarr/commit/031fc03dc0140ecc7f219839647087cfc1a2ed1b))
* **ui:** improve code formatting and structure in various components ([741619b](https://github.com/iHX-Labs/refinarr/commit/741619b8ff4f4fc07906832c410cb8adf4d94be0))
* **ui:** MediaTable virt — use real scroll element, not window ([42e16c2](https://github.com/iHX-Labs/refinarr/commit/42e16c276ecc8e8e96418f50399a75242c87c5b7))
* **ui:** sidebar Settings stays active on nested routes + tone down rail active color ([c3e9725](https://github.com/iHX-Labs/refinarr/commit/c3e9725779c417591846eb397265db0e65b7bd8a))
* **ui:** tighten MediaTable column widths ([ee36321](https://github.com/iHX-Labs/refinarr/commit/ee36321b565ddd6bb5626ebda43d8220ce8e98c5))
* **ui:** visible header for Monitored column ([e94c937](https://github.com/iHX-Labs/refinarr/commit/e94c9370ebaa401fe97a0c74bc1736acbcec569e))
* update Node.js version to 22 in CI workflow ([83e453f](https://github.com/iHX-Labs/refinarr/commit/83e453fc80b86f1c1654357ad526388740b18f6c))
* **worker:** preserve cooldown on refresh so rate limit survives config updates ([d50cc45](https://github.com/iHX-Labs/refinarr/commit/d50cc4573fde3fa1bb1fde82b7ed3c8d6e919e90))


### Performance Improvements

* **arr:** bump default ARR_RATE_LIMIT from 5 to 50 req/sec ([70962f1](https://github.com/iHX-Labs/refinarr/commit/70962f1619b6352a7624078605cfc239cdc3259e))
* **cache:** stale-while-revalidate for flagged-media cache ([879b13f](https://github.com/iHX-Labs/refinarr/commit/879b13f1efb3f18692ac75ab62af67934310b5d8))
* **cache:** stale-while-revalidate for flagged-media cache ([5a9c245](https://github.com/iHX-Labs/refinarr/commit/5a9c245dc903751862f71a05f080ae30f8d871ad))
* **media:** memoize CF option derivations + flatten nested loops ([3fe4dac](https://github.com/iHX-Labs/refinarr/commit/3fe4dace11f24fba1bab52ac5f397a2f4e3afa1a))
* **n5:** index Session.userId ([#120](https://github.com/iHX-Labs/refinarr/issues/120)) ([9d77a39](https://github.com/iHX-Labs/refinarr/commit/9d77a392a30f566e27b9fae4b3c3be8bff3462e9))

## [0.2.2](https://github.com/iHX-Labs/refinarr/compare/v0.2.1...v0.2.2) (2026-05-29)


### Bug Fixes

* **docker:** copy prisma/ before yarn install in deps stage ([#161](https://github.com/iHX-Labs/refinarr/issues/161)) ([b3a027d](https://github.com/iHX-Labs/refinarr/commit/b3a027d0fd7cf94d3d00b3e30887b3538062c926))

## [0.2.1](https://github.com/iHX-Labs/refinarr/compare/v0.2.0...v0.2.1) (2026-05-29)


### Bug Fixes

* **ci:** make release-image workflow_dispatch accept tag input ([#159](https://github.com/iHX-Labs/refinarr/issues/159)) ([3f7e99d](https://github.com/iHX-Labs/refinarr/commit/3f7e99d01aec7160bc5ab2385a6e5480fa2ecc29))

## [0.2.0](https://github.com/iHX-Labs/refinarr/compare/v0.1.2...v0.2.0) (2026-05-29)


### Features

* add refresh functionality for instances and improve caching ([6b70bd5](https://github.com/iHX-Labs/refinarr/commit/6b70bd529b42ab051ca8cc299fd287c286722ed7))
* brand identity, three themes, code-smell tooling ([fc0f19e](https://github.com/iHX-Labs/refinarr/commit/fc0f19eec38335e5309bcd82f340624bb8735ff5))
* **brand:** logo, three themes, centralized color palette ([1867add](https://github.com/iHX-Labs/refinarr/commit/1867add1d7a8909403711f41e7ed95b41750d4ff))
* **bulk:** multi-instance "All Radarr"/"All Sonarr" + Cancel button ([723793a](https://github.com/iHX-Labs/refinarr/commit/723793adb9f951dcfda0a3aa58e1d6a158b7844c))
* **bulk:** per-item progress UI for bulk actions via runSerial ([a3b712c](https://github.com/iHX-Labs/refinarr/commit/a3b712ce8ebb45778d400458548c3da9f467af64))
* enhance ESLint configuration and improve state management in hooks ([6448c9c](https://github.com/iHX-Labs/refinarr/commit/6448c9c812ecb02e9aefb969bad08e5834bc9466))
* enhance series and movie management features ([049c119](https://github.com/iHX-Labs/refinarr/commit/049c11948025e1c71afabb4f0b4913b64abf879b))
* **forms:** FormField helper with aria wiring + spinner on submits ([01c1748](https://github.com/iHX-Labs/refinarr/commit/01c1748436114bfeeacd71b1b825b64cb8729f53))
* **i18n:** integrate next-intl for toast messages in useRefreshInstance and useShowsPage hooks ([e4634c6](https://github.com/iHX-Labs/refinarr/commit/e4634c61606df1119868e4b6543cce50a0eadf27))
* **i18n:** move format-relative strings into "time" namespace + fix Math.floor ([894b5b2](https://github.com/iHX-Labs/refinarr/commit/894b5b2280d839f65f4a2f3f600c1143b5188d68))
* implement API key management in settings ([70db1c2](https://github.com/iHX-Labs/refinarr/commit/70db1c2764cda826d2617b4a97d6bc881bfd223e))
* **instances:** smart URL normalization and type-aware placeholders ([5c94a8f](https://github.com/iHX-Labs/refinarr/commit/5c94a8f675cac4a6a3cecbd4b4bf8894230a4be1))
* **layout:** mobile shell foundation — Topbar, NavContent, skip link ([cf84fd0](https://github.com/iHX-Labs/refinarr/commit/cf84fd0d90bde834357de99402dea4e57e867a71))
* **logs:** add title + instance name to media-action log lines ([803cf43](https://github.com/iHX-Labs/refinarr/commit/803cf43668f33b58cfb12ef19461524b2cafd4f0))
* **logs:** add title + instance name to media-action log lines ([be5d48e](https://github.com/iHX-Labs/refinarr/commit/be5d48e50482d8dc38c5c3dc6ccef7e31ade266f))
* **logs:** implement application logging page with filtering and clearing functionality ([2eee1d6](https://github.com/iHX-Labs/refinarr/commit/2eee1d602cc21af98b3c4bbba4120b54a89582d3))
* **media:** add MediaListShell shared shell component ([b677edc](https://github.com/iHX-Labs/refinarr/commit/b677edc670631fc8f12246b842dcb92057d4d5cc))
* **media:** banner header + multi-select CF filters with AND/OR toggle ([7cc0c4f](https://github.com/iHX-Labs/refinarr/commit/7cc0c4f0b4ba5bd8ebf77053ee8c8d3e2cc5887b))
* **media:** mobile card variant for MediaTable via renderCard prop ([a401ab6](https://github.com/iHX-Labs/refinarr/commit/a401ab6efb591609e847060ddd303fd7c540e47c))
* **media:** mobile filter sheet and fixed-bottom bulk toolbar ([4d29cfa](https://github.com/iHX-Labs/refinarr/commit/4d29cfa403290f73a2a51607b037c028a3dd025b))
* **media:** show quality profile in detail drawers ([70b6ee4](https://github.com/iHX-Labs/refinarr/commit/70b6ee4f8e464f0870a4e6ef3f34ad84fbf497e6))
* **queue:** search queue + per-row status + cross-tab SSE ([26da366](https://github.com/iHX-Labs/refinarr/commit/26da3660618765f3ca4026ddb15bd95a4c459946))
* **queue:** search queue + per-row status + cross-tab SSE ([31580d0](https://github.com/iHX-Labs/refinarr/commit/31580d05e224a387482a068ebfdcce5d78a6089f))
* **queue:** search queue stability, per-row badges, and dev housekeeping ([792d738](https://github.com/iHX-Labs/refinarr/commit/792d738a09b89ae75a71a21d0f855412768b2e6d))
* **rate-limit:** per-instance token bucket + fix CodeRabbit leftover ([02c1e9f](https://github.com/iHX-Labs/refinarr/commit/02c1e9f5bbb6262b77ce2ef8076d7ae362e312f3))
* **rate-limit:** per-instance token bucket for outbound *arr API calls ([fc849d6](https://github.com/iHX-Labs/refinarr/commit/fc849d6a5fa962cf69c00d4b0a9d3d035273774f))
* Refactor queue management and theme handling ([9b7ad94](https://github.com/iHX-Labs/refinarr/commit/9b7ad94b43361c4840a19786c1c0a88809e6b169))
* **schema:** promote scoringMode from AppConfig key to Instance column ([fdde0de](https://github.com/iHX-Labs/refinarr/commit/fdde0de77ab1b0fe6d81e9806ff35f72511302d8))
* **schema:** promote scoringMode to Instance column + plan docs ([6fdf6b7](https://github.com/iHX-Labs/refinarr/commit/6fdf6b7c190e3b39b2a024ae05de763457f3afcf))
* **settings:** promote dry-run, scroll-to-anchor from cmdk, test before save ([eb68ef2](https://github.com/iHX-Labs/refinarr/commit/eb68ef2f39ce7a5cfd3efb1aff4ba73deb5d45da))
* **states:** KpiCardSkeleton and SettingsCardSkeleton ([a0a8288](https://github.com/iHX-Labs/refinarr/commit/a0a8288c2b8976c5767c776c16c511718fd2fdc6))
* **tests:** add comprehensive tests for SeriesService and setup testing environment ([9d458d2](https://github.com/iHX-Labs/refinarr/commit/9d458d2bf7c81c214128a2038b389c6e91c417fa))
* **tests:** add integration tests for API endpoints and hooks ([fc8eefa](https://github.com/iHX-Labs/refinarr/commit/fc8eefa09a6fbfc21a24e831f4ae05656785f32b))
* **theme:** implement new theming system with surface variables and … ([22f1edd](https://github.com/iHX-Labs/refinarr/commit/22f1edd3c2de1dc845e6b7fab38fa0132eff1ba0))
* **theme:** implement new theming system with surface variables and brand support ([94ea567](https://github.com/iHX-Labs/refinarr/commit/94ea567e81784fc49270ed495aa014504346da3e))
* **ui:** settings polish + media page header + multi-select CF filters ([a4100be](https://github.com/iHX-Labs/refinarr/commit/a4100be0bd07bbaffe4bc5a77d43b44114f5ce88))
* **v2:** Phase 1 — mobile shell, responsive tables, form polish ([ae0177c](https://github.com/iHX-Labs/refinarr/commit/ae0177c62119eaba5967cdedd085777599fe13bb))
* **v2:** Phase 2A — bulk-op per-item progress ([a487790](https://github.com/iHX-Labs/refinarr/commit/a487790c679a8a747517b0dda962c3a6276b3de5))
* **v2:** Phase 2B — multi-instance bulk + Cancel button + page-hook split ([bb3da61](https://github.com/iHX-Labs/refinarr/commit/bb3da6172ab17732035974e38a2877c1430eff0b))
* **v2:** Phase 3 — ⌘K command palette + keyboard help dialog ([f10f29b](https://github.com/iHX-Labs/refinarr/commit/f10f29b0f5feea7c234b85167e6c37a61819da80))
* **v2:** Phase 3 — ⌘K command palette + keyboard help dialog ([cbfb2a2](https://github.com/iHX-Labs/refinarr/commit/cbfb2a2ea9adfde30bd74f07e14d9a2da2b5aaf8))


### Bug Fixes

* **actions:** tighten ActionType discriminator after CodeRabbit review ([cee5463](https://github.com/iHX-Labs/refinarr/commit/cee5463fc7ee6fa020fee2eb09135070f2098799))
* **actions:** validate retry payloads + handle new actions in history filter ([fb45153](https://github.com/iHX-Labs/refinarr/commit/fb451532411bb81ad48f31f20a8b98429e2d9349))
* address remaining CodeRabbit majors on PR [#27](https://github.com/iHX-Labs/refinarr/issues/27) ([6d7292c](https://github.com/iHX-Labs/refinarr/commit/6d7292c3d2dedc9019b47f4ae27aa35393b02701))
* address theme review follow-ups ([1e6970e](https://github.com/iHX-Labs/refinarr/commit/1e6970e09e3bf05f1236be558a76734a4b1a22d0))
* **api:** auto-invalidate flagged-media cache on config and instance writes ([e744301](https://github.com/iHX-Labs/refinarr/commit/e744301144e4ea4596200e52f126d9302962501e))
* **apiFetch:** improve error reporting structure for API response errors ([a602937](https://github.com/iHX-Labs/refinarr/commit/a602937b9f0eab84d47a436fe655f2c69fc7c553))
* **arr-client:** unwrap fetch error cause for actionable failure reason ([97f632e](https://github.com/iHX-Labs/refinarr/commit/97f632e9ee98f0ac8969da37886247e9d81df864))
* **auth:** SubmitEvent type + structured same-as-current error code ([d1b72f4](https://github.com/iHX-Labs/refinarr/commit/d1b72f4616bc4651e01546f80d8f4c1b7d1f0c28))
* **bulk:** use selectedItem in drawer callbacks instead of narrowed param ([3831cf3](https://github.com/iHX-Labs/refinarr/commit/3831cf382f08ff96811ed20551aa08bb11f86a02))
* **ci:** drop bump-patch-for-minor-pre-major from release-please config ([#153](https://github.com/iHX-Labs/refinarr/issues/153)) ([af7b088](https://github.com/iHX-Labs/refinarr/commit/af7b088c7b72c034d8016d541125db7d2e2d999f))
* **client-error-logger:** include stack + status=0 on network failures ([8c13d94](https://github.com/iHX-Labs/refinarr/commit/8c13d94465d6a63c22d3184bab2d86e4444ea9b4))
* **dashboard:** preserve unknown semantics in aggregated totals ([0384f67](https://github.com/iHX-Labs/refinarr/commit/0384f670f4be46621a460bc672c3f37a9a3fb3ce))
* **dashboard:** update badge display logic based on config.dryRun state ([1ae1ff5](https://github.com/iHX-Labs/refinarr/commit/1ae1ff5d8a3acd618141f1384f51e2ea8a3b33b2))
* **dashboard:** update badge display logic based on config.dryRun state ([e62aece](https://github.com/iHX-Labs/refinarr/commit/e62aece88332eea63a8bc9f1fd132d1cb589e43f))
* **docker:** bundle Prisma CLI so migrate deploy needs no internet access ([f5bb813](https://github.com/iHX-Labs/refinarr/commit/f5bb813f78ce0b397a3166844461e5726815ea22))
* **docker:** bundle Prisma CLI so migrate deploy needs no internet access ([29b9201](https://github.com/iHX-Labs/refinarr/commit/29b92019d8c334afaabf13734925f40043fcc179))
* **e2e:** migrate before next start to close globalSetup race ([e18f3e2](https://github.com/iHX-Labs/refinarr/commit/e18f3e25fafb5e022b32d706d2af159991355723))
* **e2e:** migrate in webServer command to close globalSetup race ([eba59d8](https://github.com/iHX-Labs/refinarr/commit/eba59d882a5c780b13f8be8499ee702c1509cd6a))
* **e2e:** migrate in webServer command to close globalSetup race ([b865472](https://github.com/iHX-Labs/refinarr/commit/b865472bda60c942f2ef54f2f1eb59632d318568))
* **history:** drop RetryNotSupportedError, fix recent-search ranking, add index ([39f2732](https://github.com/iHX-Labs/refinarr/commit/39f2732e74cb8c90a82d63ee887c582a334da5b1))
* **history:** guard retry against payload/row mismatch + MSW for tests ([46b3bf9](https://github.com/iHX-Labs/refinarr/commit/46b3bf9e7b292f370fc65b87d5b19ea3e903c6c5))
* **history:** make findRecentSearches order deterministic ([b2df7b0](https://github.com/iHX-Labs/refinarr/commit/b2df7b0ae1d68f0145723c511e755bb5b0edab76))
* **history:** normalize movie delete payload action to match column ([a6bf40e](https://github.com/iHX-Labs/refinarr/commit/a6bf40e75270278250fd04b0417a4c9edee1b813))
* **history:** preserve season/episode-file scope on retry ([3f0cee2](https://github.com/iHX-Labs/refinarr/commit/3f0cee2d9d108852411ebc185fcb4f563086627a))
* **history:** require action parity in retry payload guard + tighten comment ([074847c](https://github.com/iHX-Labs/refinarr/commit/074847c09826883bdbcdd48141b70f7b6f2f6d66))
* **history:** retry updates the existing row instead of creating a duplicate ([2d38475](https://github.com/iHX-Labs/refinarr/commit/2d38475900754bacbdb6fc94a0da069a57508cbb))
* **history:** retry updates the existing row instead of creating a duplicate ([5620c92](https://github.com/iHX-Labs/refinarr/commit/5620c9298c89af2ad698cb613dfcd98c2bf48166))
* **i18n:** ICU plurals for queue count strings ([e1e207f](https://github.com/iHX-Labs/refinarr/commit/e1e207fccda4759453dc567c8e9dad5144c8c476))
* **instance-service:** include failure reason in Connection/Credentials test error logs ([accc566](https://github.com/iHX-Labs/refinarr/commit/accc566c6d935c041e629265a5e5560d63c74be7))
* **instance-service:** log connection test failures at error level ([7d4afb9](https://github.com/iHX-Labs/refinarr/commit/7d4afb9971c0236ad9ca27f35f1233a6ead0d586))
* **media:** don't apply maxScore filter in profile mode ([c72fbfa](https://github.com/iHX-Labs/refinarr/commit/c72fbfa7020f5d0c87ceab67f76220c11ee7b06b))
* **media:** e2e + CodeRabbit + filter-hook DRY ([82bb301](https://github.com/iHX-Labs/refinarr/commit/82bb3011df57c21771b3a681cdb80ff9d2dee154))
* **media:** invalidate flagged-media cache on successful action ([43230b6](https://github.com/iHX-Labs/refinarr/commit/43230b63ca074f286face0147f72691646e74b37))
* **media:** invalidate flagged-media cache on successful action ([b5e0875](https://github.com/iHX-Labs/refinarr/commit/b5e08756aa66938918c70bfb00e9d325f09d5ed8))
* prevent stale cache rebuild writes ([6be5ce6](https://github.com/iHX-Labs/refinarr/commit/6be5ce692aacdd923489d50217f0fac136641d6a))
* **proxy:** drop `export const runtime = "nodejs"` (disallowed in Next.js 16 Proxy) ([4bbe1c9](https://github.com/iHX-Labs/refinarr/commit/4bbe1c93922c9ec75ae91f2488b4daae385504a1))
* **queue:** address CodeRabbit findings across queue, SSE, and settings ([d7cedc4](https://github.com/iHX-Labs/refinarr/commit/d7cedc4a9a6257ee70931888c8080869a833e177))
* **queue:** address three CodeRabbit findings ([951a56b](https://github.com/iHX-Labs/refinarr/commit/951a56b190f6c7e9cf05ce0c70c8dfc9283d2c51))
* **rate-limit:** FIFO queue, fractional rate, concurrent-waiter test ([769ad18](https://github.com/iHX-Labs/refinarr/commit/769ad18afe74935acdf491f0e52bdc307261301c))
* **rate-limit:** guard against NaN when ARR_RATE_LIMIT is non-numeric ([99882b8](https://github.com/iHX-Labs/refinarr/commit/99882b8ab9c1e652b81b761c0a6bba830a20f2b4))
* route mutation toasts through helper ([e1de04b](https://github.com/iHX-Labs/refinarr/commit/e1de04b64a1fdf77b2de25aa9b5b26ca1fa1dc8c))
* **route:** improve cursor validation for SSE connections ([6012379](https://github.com/iHX-Labs/refinarr/commit/6012379a8a133e06df56265dcbce541251a0e6ca))
* **services:** drop cache-build logs to debug level ([c079b76](https://github.com/iHX-Labs/refinarr/commit/c079b7682dc103813451667f242e887c4383917c))
* **test:** reorder useFlaggedMediaData test imports ([73a074e](https://github.com/iHX-Labs/refinarr/commit/73a074e45f0d09d51417fa2c1b66b41060360654))
* **tests:** exercise both scoringMode branches to keep coverage &gt;= 85% ([60342e4](https://github.com/iHX-Labs/refinarr/commit/60342e4fa14dc5cab3d1b8a119c33b389cb300ac))
* **toast:** drop English fallbacks; guard scoring-mode select value ([df4ee21](https://github.com/iHX-Labs/refinarr/commit/df4ee21f8c69a7d0df80ac27ff255acdfd57b8c1))
* update Node.js version to 22 in CI workflow ([83e453f](https://github.com/iHX-Labs/refinarr/commit/83e453fc80b86f1c1654357ad526388740b18f6c))
* **worker:** preserve cooldown on refresh so rate limit survives config updates ([d50cc45](https://github.com/iHX-Labs/refinarr/commit/d50cc4573fde3fa1bb1fde82b7ed3c8d6e919e90))


### Performance Improvements

* **arr:** bump default ARR_RATE_LIMIT from 5 to 50 req/sec ([70962f1](https://github.com/iHX-Labs/refinarr/commit/70962f1619b6352a7624078605cfc239cdc3259e))
* **cache:** stale-while-revalidate for flagged-media cache ([879b13f](https://github.com/iHX-Labs/refinarr/commit/879b13f1efb3f18692ac75ab62af67934310b5d8))
* **cache:** stale-while-revalidate for flagged-media cache ([5a9c245](https://github.com/iHX-Labs/refinarr/commit/5a9c245dc903751862f71a05f080ae30f8d871ad))
* **media:** memoize CF option derivations + flatten nested loops ([3fe4dac](https://github.com/iHX-Labs/refinarr/commit/3fe4dace11f24fba1bab52ac5f397a2f4e3afa1a))

## [0.1.2](https://github.com/iHX-Labs/refinarr/compare/refinarr-v0.1.1...refinarr-v0.1.2) (2026-05-29)


### Bug Fixes

* **ci:** drop bump-patch-for-minor-pre-major from release-please config ([#153](https://github.com/iHX-Labs/refinarr/issues/153)) ([af7b088](https://github.com/iHX-Labs/refinarr/commit/af7b088c7b72c034d8016d541125db7d2e2d999f))

## [0.1.1](https://github.com/iHX-Labs/refinarr/compare/refinarr-v0.1.0...refinarr-v0.1.1) (2026-05-29)


### Features

* add refresh functionality for instances and improve caching ([6b70bd5](https://github.com/iHX-Labs/refinarr/commit/6b70bd529b42ab051ca8cc299fd287c286722ed7))
* brand identity, three themes, code-smell tooling ([fc0f19e](https://github.com/iHX-Labs/refinarr/commit/fc0f19eec38335e5309bcd82f340624bb8735ff5))
* **brand:** logo, three themes, centralized color palette ([1867add](https://github.com/iHX-Labs/refinarr/commit/1867add1d7a8909403711f41e7ed95b41750d4ff))
* **bulk:** multi-instance "All Radarr"/"All Sonarr" + Cancel button ([723793a](https://github.com/iHX-Labs/refinarr/commit/723793adb9f951dcfda0a3aa58e1d6a158b7844c))
* **bulk:** per-item progress UI for bulk actions via runSerial ([a3b712c](https://github.com/iHX-Labs/refinarr/commit/a3b712ce8ebb45778d400458548c3da9f467af64))
* enhance ESLint configuration and improve state management in hooks ([6448c9c](https://github.com/iHX-Labs/refinarr/commit/6448c9c812ecb02e9aefb969bad08e5834bc9466))
* enhance series and movie management features ([049c119](https://github.com/iHX-Labs/refinarr/commit/049c11948025e1c71afabb4f0b4913b64abf879b))
* **forms:** FormField helper with aria wiring + spinner on submits ([01c1748](https://github.com/iHX-Labs/refinarr/commit/01c1748436114bfeeacd71b1b825b64cb8729f53))
* **i18n:** integrate next-intl for toast messages in useRefreshInstance and useShowsPage hooks ([e4634c6](https://github.com/iHX-Labs/refinarr/commit/e4634c61606df1119868e4b6543cce50a0eadf27))
* **i18n:** move format-relative strings into "time" namespace + fix Math.floor ([894b5b2](https://github.com/iHX-Labs/refinarr/commit/894b5b2280d839f65f4a2f3f600c1143b5188d68))
* implement API key management in settings ([70db1c2](https://github.com/iHX-Labs/refinarr/commit/70db1c2764cda826d2617b4a97d6bc881bfd223e))
* **instances:** smart URL normalization and type-aware placeholders ([5c94a8f](https://github.com/iHX-Labs/refinarr/commit/5c94a8f675cac4a6a3cecbd4b4bf8894230a4be1))
* **layout:** mobile shell foundation — Topbar, NavContent, skip link ([cf84fd0](https://github.com/iHX-Labs/refinarr/commit/cf84fd0d90bde834357de99402dea4e57e867a71))
* **logs:** add title + instance name to media-action log lines ([803cf43](https://github.com/iHX-Labs/refinarr/commit/803cf43668f33b58cfb12ef19461524b2cafd4f0))
* **logs:** add title + instance name to media-action log lines ([be5d48e](https://github.com/iHX-Labs/refinarr/commit/be5d48e50482d8dc38c5c3dc6ccef7e31ade266f))
* **logs:** implement application logging page with filtering and clearing functionality ([2eee1d6](https://github.com/iHX-Labs/refinarr/commit/2eee1d602cc21af98b3c4bbba4120b54a89582d3))
* **media:** add MediaListShell shared shell component ([b677edc](https://github.com/iHX-Labs/refinarr/commit/b677edc670631fc8f12246b842dcb92057d4d5cc))
* **media:** banner header + multi-select CF filters with AND/OR toggle ([7cc0c4f](https://github.com/iHX-Labs/refinarr/commit/7cc0c4f0b4ba5bd8ebf77053ee8c8d3e2cc5887b))
* **media:** mobile card variant for MediaTable via renderCard prop ([a401ab6](https://github.com/iHX-Labs/refinarr/commit/a401ab6efb591609e847060ddd303fd7c540e47c))
* **media:** mobile filter sheet and fixed-bottom bulk toolbar ([4d29cfa](https://github.com/iHX-Labs/refinarr/commit/4d29cfa403290f73a2a51607b037c028a3dd025b))
* **media:** show quality profile in detail drawers ([70b6ee4](https://github.com/iHX-Labs/refinarr/commit/70b6ee4f8e464f0870a4e6ef3f34ad84fbf497e6))
* **queue:** search queue + per-row status + cross-tab SSE ([26da366](https://github.com/iHX-Labs/refinarr/commit/26da3660618765f3ca4026ddb15bd95a4c459946))
* **queue:** search queue + per-row status + cross-tab SSE ([31580d0](https://github.com/iHX-Labs/refinarr/commit/31580d05e224a387482a068ebfdcce5d78a6089f))
* **queue:** search queue stability, per-row badges, and dev housekeeping ([792d738](https://github.com/iHX-Labs/refinarr/commit/792d738a09b89ae75a71a21d0f855412768b2e6d))
* **rate-limit:** per-instance token bucket + fix CodeRabbit leftover ([02c1e9f](https://github.com/iHX-Labs/refinarr/commit/02c1e9f5bbb6262b77ce2ef8076d7ae362e312f3))
* **rate-limit:** per-instance token bucket for outbound *arr API calls ([fc849d6](https://github.com/iHX-Labs/refinarr/commit/fc849d6a5fa962cf69c00d4b0a9d3d035273774f))
* Refactor queue management and theme handling ([9b7ad94](https://github.com/iHX-Labs/refinarr/commit/9b7ad94b43361c4840a19786c1c0a88809e6b169))
* **schema:** promote scoringMode from AppConfig key to Instance column ([fdde0de](https://github.com/iHX-Labs/refinarr/commit/fdde0de77ab1b0fe6d81e9806ff35f72511302d8))
* **schema:** promote scoringMode to Instance column + plan docs ([6fdf6b7](https://github.com/iHX-Labs/refinarr/commit/6fdf6b7c190e3b39b2a024ae05de763457f3afcf))
* **settings:** promote dry-run, scroll-to-anchor from cmdk, test before save ([eb68ef2](https://github.com/iHX-Labs/refinarr/commit/eb68ef2f39ce7a5cfd3efb1aff4ba73deb5d45da))
* **states:** KpiCardSkeleton and SettingsCardSkeleton ([a0a8288](https://github.com/iHX-Labs/refinarr/commit/a0a8288c2b8976c5767c776c16c511718fd2fdc6))
* **tests:** add comprehensive tests for SeriesService and setup testing environment ([9d458d2](https://github.com/iHX-Labs/refinarr/commit/9d458d2bf7c81c214128a2038b389c6e91c417fa))
* **tests:** add integration tests for API endpoints and hooks ([fc8eefa](https://github.com/iHX-Labs/refinarr/commit/fc8eefa09a6fbfc21a24e831f4ae05656785f32b))
* **theme:** implement new theming system with surface variables and … ([22f1edd](https://github.com/iHX-Labs/refinarr/commit/22f1edd3c2de1dc845e6b7fab38fa0132eff1ba0))
* **theme:** implement new theming system with surface variables and brand support ([94ea567](https://github.com/iHX-Labs/refinarr/commit/94ea567e81784fc49270ed495aa014504346da3e))
* **ui:** settings polish + media page header + multi-select CF filters ([a4100be](https://github.com/iHX-Labs/refinarr/commit/a4100be0bd07bbaffe4bc5a77d43b44114f5ce88))
* **v2:** Phase 1 — mobile shell, responsive tables, form polish ([ae0177c](https://github.com/iHX-Labs/refinarr/commit/ae0177c62119eaba5967cdedd085777599fe13bb))
* **v2:** Phase 2A — bulk-op per-item progress ([a487790](https://github.com/iHX-Labs/refinarr/commit/a487790c679a8a747517b0dda962c3a6276b3de5))
* **v2:** Phase 2B — multi-instance bulk + Cancel button + page-hook split ([bb3da61](https://github.com/iHX-Labs/refinarr/commit/bb3da6172ab17732035974e38a2877c1430eff0b))
* **v2:** Phase 3 — ⌘K command palette + keyboard help dialog ([f10f29b](https://github.com/iHX-Labs/refinarr/commit/f10f29b0f5feea7c234b85167e6c37a61819da80))
* **v2:** Phase 3 — ⌘K command palette + keyboard help dialog ([cbfb2a2](https://github.com/iHX-Labs/refinarr/commit/cbfb2a2ea9adfde30bd74f07e14d9a2da2b5aaf8))


### Bug Fixes

* **actions:** tighten ActionType discriminator after CodeRabbit review ([cee5463](https://github.com/iHX-Labs/refinarr/commit/cee5463fc7ee6fa020fee2eb09135070f2098799))
* **actions:** validate retry payloads + handle new actions in history filter ([fb45153](https://github.com/iHX-Labs/refinarr/commit/fb451532411bb81ad48f31f20a8b98429e2d9349))
* address remaining CodeRabbit majors on PR [#27](https://github.com/iHX-Labs/refinarr/issues/27) ([6d7292c](https://github.com/iHX-Labs/refinarr/commit/6d7292c3d2dedc9019b47f4ae27aa35393b02701))
* address theme review follow-ups ([1e6970e](https://github.com/iHX-Labs/refinarr/commit/1e6970e09e3bf05f1236be558a76734a4b1a22d0))
* **api:** auto-invalidate flagged-media cache on config and instance writes ([e744301](https://github.com/iHX-Labs/refinarr/commit/e744301144e4ea4596200e52f126d9302962501e))
* **apiFetch:** improve error reporting structure for API response errors ([a602937](https://github.com/iHX-Labs/refinarr/commit/a602937b9f0eab84d47a436fe655f2c69fc7c553))
* **arr-client:** unwrap fetch error cause for actionable failure reason ([97f632e](https://github.com/iHX-Labs/refinarr/commit/97f632e9ee98f0ac8969da37886247e9d81df864))
* **auth:** SubmitEvent type + structured same-as-current error code ([d1b72f4](https://github.com/iHX-Labs/refinarr/commit/d1b72f4616bc4651e01546f80d8f4c1b7d1f0c28))
* **bulk:** use selectedItem in drawer callbacks instead of narrowed param ([3831cf3](https://github.com/iHX-Labs/refinarr/commit/3831cf382f08ff96811ed20551aa08bb11f86a02))
* **client-error-logger:** include stack + status=0 on network failures ([8c13d94](https://github.com/iHX-Labs/refinarr/commit/8c13d94465d6a63c22d3184bab2d86e4444ea9b4))
* **dashboard:** preserve unknown semantics in aggregated totals ([0384f67](https://github.com/iHX-Labs/refinarr/commit/0384f670f4be46621a460bc672c3f37a9a3fb3ce))
* **dashboard:** update badge display logic based on config.dryRun state ([1ae1ff5](https://github.com/iHX-Labs/refinarr/commit/1ae1ff5d8a3acd618141f1384f51e2ea8a3b33b2))
* **dashboard:** update badge display logic based on config.dryRun state ([e62aece](https://github.com/iHX-Labs/refinarr/commit/e62aece88332eea63a8bc9f1fd132d1cb589e43f))
* **docker:** bundle Prisma CLI so migrate deploy needs no internet access ([f5bb813](https://github.com/iHX-Labs/refinarr/commit/f5bb813f78ce0b397a3166844461e5726815ea22))
* **docker:** bundle Prisma CLI so migrate deploy needs no internet access ([29b9201](https://github.com/iHX-Labs/refinarr/commit/29b92019d8c334afaabf13734925f40043fcc179))
* **e2e:** migrate before next start to close globalSetup race ([e18f3e2](https://github.com/iHX-Labs/refinarr/commit/e18f3e25fafb5e022b32d706d2af159991355723))
* **e2e:** migrate in webServer command to close globalSetup race ([eba59d8](https://github.com/iHX-Labs/refinarr/commit/eba59d882a5c780b13f8be8499ee702c1509cd6a))
* **e2e:** migrate in webServer command to close globalSetup race ([b865472](https://github.com/iHX-Labs/refinarr/commit/b865472bda60c942f2ef54f2f1eb59632d318568))
* **history:** drop RetryNotSupportedError, fix recent-search ranking, add index ([39f2732](https://github.com/iHX-Labs/refinarr/commit/39f2732e74cb8c90a82d63ee887c582a334da5b1))
* **history:** guard retry against payload/row mismatch + MSW for tests ([46b3bf9](https://github.com/iHX-Labs/refinarr/commit/46b3bf9e7b292f370fc65b87d5b19ea3e903c6c5))
* **history:** make findRecentSearches order deterministic ([b2df7b0](https://github.com/iHX-Labs/refinarr/commit/b2df7b0ae1d68f0145723c511e755bb5b0edab76))
* **history:** normalize movie delete payload action to match column ([a6bf40e](https://github.com/iHX-Labs/refinarr/commit/a6bf40e75270278250fd04b0417a4c9edee1b813))
* **history:** preserve season/episode-file scope on retry ([3f0cee2](https://github.com/iHX-Labs/refinarr/commit/3f0cee2d9d108852411ebc185fcb4f563086627a))
* **history:** require action parity in retry payload guard + tighten comment ([074847c](https://github.com/iHX-Labs/refinarr/commit/074847c09826883bdbcdd48141b70f7b6f2f6d66))
* **history:** retry updates the existing row instead of creating a duplicate ([2d38475](https://github.com/iHX-Labs/refinarr/commit/2d38475900754bacbdb6fc94a0da069a57508cbb))
* **history:** retry updates the existing row instead of creating a duplicate ([5620c92](https://github.com/iHX-Labs/refinarr/commit/5620c9298c89af2ad698cb613dfcd98c2bf48166))
* **i18n:** ICU plurals for queue count strings ([e1e207f](https://github.com/iHX-Labs/refinarr/commit/e1e207fccda4759453dc567c8e9dad5144c8c476))
* **instance-service:** include failure reason in Connection/Credentials test error logs ([accc566](https://github.com/iHX-Labs/refinarr/commit/accc566c6d935c041e629265a5e5560d63c74be7))
* **instance-service:** log connection test failures at error level ([7d4afb9](https://github.com/iHX-Labs/refinarr/commit/7d4afb9971c0236ad9ca27f35f1233a6ead0d586))
* **media:** don't apply maxScore filter in profile mode ([c72fbfa](https://github.com/iHX-Labs/refinarr/commit/c72fbfa7020f5d0c87ceab67f76220c11ee7b06b))
* **media:** e2e + CodeRabbit + filter-hook DRY ([82bb301](https://github.com/iHX-Labs/refinarr/commit/82bb3011df57c21771b3a681cdb80ff9d2dee154))
* **media:** invalidate flagged-media cache on successful action ([43230b6](https://github.com/iHX-Labs/refinarr/commit/43230b63ca074f286face0147f72691646e74b37))
* **media:** invalidate flagged-media cache on successful action ([b5e0875](https://github.com/iHX-Labs/refinarr/commit/b5e08756aa66938918c70bfb00e9d325f09d5ed8))
* prevent stale cache rebuild writes ([6be5ce6](https://github.com/iHX-Labs/refinarr/commit/6be5ce692aacdd923489d50217f0fac136641d6a))
* **proxy:** drop `export const runtime = "nodejs"` (disallowed in Next.js 16 Proxy) ([4bbe1c9](https://github.com/iHX-Labs/refinarr/commit/4bbe1c93922c9ec75ae91f2488b4daae385504a1))
* **queue:** address CodeRabbit findings across queue, SSE, and settings ([d7cedc4](https://github.com/iHX-Labs/refinarr/commit/d7cedc4a9a6257ee70931888c8080869a833e177))
* **queue:** address three CodeRabbit findings ([951a56b](https://github.com/iHX-Labs/refinarr/commit/951a56b190f6c7e9cf05ce0c70c8dfc9283d2c51))
* **rate-limit:** FIFO queue, fractional rate, concurrent-waiter test ([769ad18](https://github.com/iHX-Labs/refinarr/commit/769ad18afe74935acdf491f0e52bdc307261301c))
* **rate-limit:** guard against NaN when ARR_RATE_LIMIT is non-numeric ([99882b8](https://github.com/iHX-Labs/refinarr/commit/99882b8ab9c1e652b81b761c0a6bba830a20f2b4))
* route mutation toasts through helper ([e1de04b](https://github.com/iHX-Labs/refinarr/commit/e1de04b64a1fdf77b2de25aa9b5b26ca1fa1dc8c))
* **route:** improve cursor validation for SSE connections ([6012379](https://github.com/iHX-Labs/refinarr/commit/6012379a8a133e06df56265dcbce541251a0e6ca))
* **services:** drop cache-build logs to debug level ([c079b76](https://github.com/iHX-Labs/refinarr/commit/c079b7682dc103813451667f242e887c4383917c))
* **test:** reorder useFlaggedMediaData test imports ([73a074e](https://github.com/iHX-Labs/refinarr/commit/73a074e45f0d09d51417fa2c1b66b41060360654))
* **tests:** exercise both scoringMode branches to keep coverage &gt;= 85% ([60342e4](https://github.com/iHX-Labs/refinarr/commit/60342e4fa14dc5cab3d1b8a119c33b389cb300ac))
* **toast:** drop English fallbacks; guard scoring-mode select value ([df4ee21](https://github.com/iHX-Labs/refinarr/commit/df4ee21f8c69a7d0df80ac27ff255acdfd57b8c1))
* update Node.js version to 22 in CI workflow ([83e453f](https://github.com/iHX-Labs/refinarr/commit/83e453fc80b86f1c1654357ad526388740b18f6c))
* **worker:** preserve cooldown on refresh so rate limit survives config updates ([d50cc45](https://github.com/iHX-Labs/refinarr/commit/d50cc4573fde3fa1bb1fde82b7ed3c8d6e919e90))


### Performance Improvements

* **arr:** bump default ARR_RATE_LIMIT from 5 to 50 req/sec ([70962f1](https://github.com/iHX-Labs/refinarr/commit/70962f1619b6352a7624078605cfc239cdc3259e))
* **cache:** stale-while-revalidate for flagged-media cache ([879b13f](https://github.com/iHX-Labs/refinarr/commit/879b13f1efb3f18692ac75ab62af67934310b5d8))
* **cache:** stale-while-revalidate for flagged-media cache ([5a9c245](https://github.com/iHX-Labs/refinarr/commit/5a9c245dc903751862f71a05f080ae30f8d871ad))
* **media:** memoize CF option derivations + flatten nested loops ([3fe4dac](https://github.com/iHX-Labs/refinarr/commit/3fe4dace11f24fba1bab52ac5f397a2f4e3afa1a))
