/**
 * QuestNote Service Worker — V3.17.0
 * 快取 App Shell 與靜態資源，支援離線使用
 * data/global-mailbox.json 使用動態 Network First，不進 App Shell precache
 * 作者本機工具（mailbox publisher／pet series builder／summon preview）原始碼不得加入 App Shell precache
 * 寵物圖片不得加入 App Shell precache
 */

const CACHE_NAME = 'questnote-preview-app-f43ef28ad03ccc759f12ca01940c04066ffae65cb075e55ba3f92d4b227f6ec5';
const PET_IMAGE_CACHE = 'questnote-preview-pet-images-v1';
const MAILBOX_RUNTIME_CACHE = 'questnote-preview-mailbox-runtime-v1';
const MAILBOX_FETCH_TIMEOUT_MS = 7000;

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data?.json() || {}; } catch { /* Always show a visible fallback. */ }
    const expired = typeof data.expiresAt === 'number' && data.expiresAt < Date.now();
    await self.registration.showNotification(expired ? 'QuestNote' : String(data.title || 'QuestNote 今日計畫').slice(0, 100), {
      body: expired ? '開啟 QuestNote 查看最新計畫。' : String(data.body || '點開查看今日任務與習慣。').slice(0, 700),
      icon: new URL('assets/brand/questnote-icon-192.png', self.registration.scope).href,
      badge: new URL('assets/brand/questnote-icon-192.png', self.registration.scope).href,
      tag: String(data.tag || 'questnote-daily').slice(0, 100),
      data: { type: 'questnote-open-today' },
    });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
    const client = windows.find((c) => c.url.startsWith(self.registration.scope));
    if (client) { await client.focus(); client.postMessage({ type: 'questnote-open-today' }); return; }
    const url = new URL('index.html', self.registration.scope);
    url.searchParams.set('reminder', 'today');
    await self.clients.openWindow(url.href);
  })());
});
// Filled by the release assembler. Source checkouts are not release artifacts.
const BUILD_PROFILE = {
  "schemaVersion": 1,
  "profile": "preview",
  "artifactId": "f43ef28ad03ccc759f12ca01940c04066ffae65cb075e55ba3f92d4b227f6ec5",
  "sourceCommit": "f426cc03bcf5a35338ff0cacc9194d3411c71d1f",
  "scopePath": "/questnote-pwa-preview/",
  "runtimeContentSchema": 1,
  "dbName": "QuestNotePreviewDB",
  "cacheNamespace": "questnote-preview-",
  "contentBundleSha256": "53f3cf3aea133c9186cbaf0396dfd54241d5fb0bb4debbf57601cd4d2c944046",
  "contentBundleUrl": "data/releases/53f3cf3aea133c9186cbaf0396dfd54241d5fb0bb4debbf57601cd4d2c944046/catalog.json"
};
const PRECACHE_HASHES = {
  "assets/brand/questnote-icon-180.png": "568c5f586481050de3c0263794de557f36acb340346eba7db1a9cdc7b000f9bf",
  "assets/brand/questnote-icon-192.png": "7a2c068ff50729b5b68aba6999ffed491234c11a267ddf26ee6f7a5bc0a1db11",
  "assets/brand/questnote-icon-32.png": "0c09c5fef9a6c10f9e10fab7a923d6e84e06972791106a9960bfe062b83952fe",
  "assets/brand/questnote-icon-512.png": "32c505609ea48e4ffab010e2fc53b184441a8bad39d79a45701b658b31040a06",
  "assets/brand/questnote-icon-maskable-512.png": "54dc03e7eb13c3f4714bc276ea2b9bb1313ef171d27e06f6aa1f378931c6f506",
  "assets/brand/questnote-icon-master-1024.png": "45eabdd090efcaee9c9305bca6d559983433c00db41c287f92f66fbac809adf3",
  "assets/expeditions/astral_rift.webp": "343c7342d7156be0fef42c809e0028811a936e2ba478b2785eaf498845dc4d2d",
  "assets/expeditions/aurora_feast_garden.webp": "c2c3fbe789b07c3dbba001e2f0ddbe9d0e10fe09df607f772ed85acd77920940",
  "assets/expeditions/cloudrest_trail.svg": "7c515cbfa33e475c939c53ff680ebe25c8f5f37f8cd2b4e33771b7a3ac8bffa8",
  "assets/expeditions/cloudrest_trail.webp": "cf75419ec519bb473ac49f32a6c9af68165550117585ab32649caae2ad9108fd",
  "assets/expeditions/darkcrown_border.webp": "689d9423da5acb1a983147ff18dfb5103953fec35fa52ec0908abf1417149d34",
  "assets/expeditions/harvest_fields.webp": "6196b84c367ff547d91741d36a57ed06aa34e15464ddafb071d4940d0014a29c",
  "assets/expeditions/lava_rift.webp": "9c14dd71f7752f8ca652992659ba929a094512ec5dc34b4d3806b90dabac904e",
  "assets/expeditions/lionheart_city.svg": "ef0402594a19080038e6984b6373134205261ed6050cea47db5309e8c46f4e38",
  "assets/expeditions/lionheart_city.webp": "283198a96c818efb61bcd8e29a45f8b6109aac408533719b5f913914c85b19bf",
  "assets/expeditions/machine_ruins.webp": "14947a69cacfa25522b20159f5f135734fc5eac25f58a55ae9cb09fc3dccd3b1",
  "assets/expeditions/mist_forest.webp": "d97f0f24d8189b4e882b8da213399b5dba992481d97917c196c5d9bbaded8dc1",
  "assets/expeditions/polar_shore.webp": "e963c18f17a9d60746f2601822f7e0ab18be730629b8de9a3fdf546381891506",
  "assets/icons/icon-192.png": "f47dd61d5e26732d2d20aba9051e7ce922449a6095a3715f7e803a2037857fb1",
  "assets/icons/icon-512.png": "8623855b674e1bb7c10525ff0118b0f4b1da5de551753d724238b62db8c403be",
  "assets/icons/lucide/LICENSE": "b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57",
  "assets/icons/lucide/provenance.json": "8464eee7709fe8ba57a1020c0a36b3ecf52175691d9453860322b22997f9ac2c",
  "assets/scenes/garden-graywolf.webp": "6379b2ad98da53856816d0e11b0048af8a9632002a28c3d362f16fa98c2f5cdc",
  "assets/scenes/night-graywolf.webp": "4dd1183fd2aa0db6ac52f845515c3c8e2e0fe2aced5a4a7d6a66732d5c114edb",
  "assets/scenes/twilight-graywolf.webp": "f8000f2b473ec9eedb3bef4e1a34dc8354351041cfc5eb261d80f98271e84f9a",
  "data/achievements.json": "776500e4349d56741a41e4ff6b45ccf8cf342c0b2fa41f11496c51d21c9455dc",
  "data/bond-stories.json": "4b6f40038a9477517adbcc80682ae1f0a753afe2217e487e135634e77c15ba35",
  "data/categories.json": "0b541c002a6684818e679e9c4b1925579fa5deeae5174003643b7c2435eb25db",
  "data/craftables.json": "95b82ff59299bd33178a64ae801d3725d6ad0a9812db9f2e0743633bfce56a4f",
  "data/dailyWheelRewards.json": "caa1634588c66e4ea46ede23ed5c8bdb4a3d5fa0deceed9521d12234477824d8",
  "data/expeditions.json": "34620b7aaf50f26d91d560050c76acc71dab148510e6275e1dfe6c73f272aca2",
  "data/gift-affinities.json": "9de6c95bd696bf98955c0fd04ffcf0ad3a23dd9667a9b388ae8329000eab324b",
  "data/materials.json": "e301faa6c4f7d8c5ca4bc771d189917cab56f07f3457883bad84849489969455",
  "data/pet-awakening.json": "3ff5161ac3d276653c6341158f5b830b445f93bc4f4c7905158e8cc4bfeb6409",
  "data/pet-series.json": "b176c710383e78b2e0b6d543bfce5d4244438dfabf2b38806c972f9b555dbc57",
  "data/pets-lore.json": "77dce9e5fbab60b01bf31d5b2e73564c4feeadd8f63380c18bebfec128d6123f",
  "data/pets.json": "a90c6afec9c1d7f95f6dff52020ece50c18d820e5c386a0a067618e9b20b9d00",
  "data/pools.json": "4fd1cdc8674e5592b6b2256603bad59b5bf555650c482237eedb6a86b3867fcc",
  "data/releases/53f3cf3aea133c9186cbaf0396dfd54241d5fb0bb4debbf57601cd4d2c944046/catalog.json": "53f3cf3aea133c9186cbaf0396dfd54241d5fb0bb4debbf57601cd4d2c944046",
  "data/titles.json": "ea884cd1a86ff66a8512ba8016632eaea57ee25d55db3cff2a3afac6dc602fcb",
  "index.html": "4b1a2392eb2570852157a7c7b8f926b21a5079dcf339dfc9cc0c8f7c7a5e5bd7",
  "manifest.webmanifest": "92eebd112db700add8829cda91380b117bcf4f4d91723ea899055ebde22caad0",
  "src/achievementService.js": "9d2b24cb553d3ec084edf353b5be0da3a50c3b527175d0fb8ca3269f7af34ca9",
  "src/adventureHandbookService.js": "8ac72423649a5d786e10af713225add10802f02feb9a8ad24ab537b34e639f79",
  "src/app.js": "46ceff3e165107cb45ed28c44fcfe5cf67c670633fb483db4103f2170cd802fe",
  "src/appBadge.js": "5a591fe79f84832bde41d6fb6b75ac9f5ccc35c20eea262d31f643298b9bc9ff",
  "src/aurora-fairy-feast.css": "1257ed271007548d4556a8c19c9948b6221ac7c91cd5a3b8e1382fba1aff2feb",
  "src/auroraFairyScene.js": "e541a90166e670c6f687ef34eb499dcdbcfc88fb877e9c436ab36d286276c361",
  "src/backupSchema.js": "33cb4644253ef2862e7b4ffa993415ec7a1f75b5e3f1953189701d29b493bbc7",
  "src/backupService.js": "7cc09354b4c8b19d103c6e5893f261b0e8a20fd8d13ffa0d1325e83588d47f43",
  "src/bond-journey.css": "be3fe7bd609e5d497767d29981c9a3b6569d8272e84d6e21cd0b30e729824f9c",
  "src/bondJourneyController.js": "1502a76313d7bc71c55e567455609a195d1d67fc081ecfe609e33bb354602e10",
  "src/bondJourneyCore.js": "67fbd335e0ce5d80a1e0f8c16e1b8ab876f2ae8b9750aef25f33cc2e8d28d5d3",
  "src/bondJourneyService.js": "2cadaffe0b549aac66a623b159385bf2aa76145a56692dc7abdaefd548412711",
  "src/bondJourneyView.js": "439e5efc4417e5c7513ee3a995285e119450664813e3f5a7636326c9943c6dc9",
  "src/bondStoryCatalog.js": "02f197543f5b44680ce5e73c405254631c441d64ab7f1b3ea99062920afc7246",
  "src/bootstrap.js": "b496961b22f6ee369ea8daf8a04cdf72d03f31e43cc826549b61a017f2079ad2",
  "src/bootstrapRecovery.js": "eb176fdeda0af8c1605c3fdc8f18876028938ce04541154c8faee530732bad34",
  "src/campService.js": "54b82fc8da105b747407ba320f6ca36c94eea5c7597b052f9a577783803a8038",
  "src/categoryService.js": "291e9605c019809dbc706d864f39cc7fc0f49d199c70257b596d77f1f35e6785",
  "src/chaos-demon-court.css": "a5a1981c52943ed9db0717a32204207ea2596a5ed9e258865440aa48862e3204",
  "src/chaosDemonCourtScene.js": "20368124da9871783a8c211aed2e24d9c55b88dc428f089934ff8257de66af89",
  "src/collectionMilestoneService.js": "978d7330a4a23060ba739f0a1a842a6d205608f2cbc07caa04c24832d872a7e8",
  "src/collectionService.js": "d6fb9004005907bbba89ad5c5805bc3aa7fa5ea16f36caf483c8d09084446fa1",
  "src/companionDialogueService.js": "ccb1a4af895ad725cd718926ac64f08b31dfee29e80dbfc24c4fb0e82e399d83",
  "src/companionService.js": "22ad8636d5d55f879d88e62a22d4bf55c7bf8b149bad897a9b1b9ff2b8c4fd8d",
  "src/daily-race.css": "68a11a3a2225e8727309ca3eb55b039e13adc24986b79471366e7c90de0e7b42",
  "src/dailyCheckInService.js": "86db627af1e1ad964fafa0e476b42e32d5f013c949e6863b39acd483bb42c32e",
  "src/dailyEncounterCore.js": "342254c78344d58e99fd8e98122efa0c4f1eae3c7d604a2749afcebd831f4bef",
  "src/dailyRaceController.js": "dc04f90ea68b12d3901973807b0b87b408dce064bb2697b46499b951e1abaccc",
  "src/dailyRaceCore.js": "da617bee480b168f6c4b16fdcb808232bc9fbd8d326b4731610ec74f41f195bd",
  "src/dailyRaceScene.js": "68ee842fa24b57add4a5a3c3a8ecf1757c7bedf3cbc932bc53510aaceaf8c079",
  "src/dailyRaceService.js": "596bad5fa9990981fbcc08dc02660b55bde6edc50233ef5954b338ddcbbd3755",
  "src/db.js": "0b1ce288ecb9df7c5091b9ad88194f32cbaa7b11db66ee0871be1a87eaf47ce8",
  "src/deferredRenderGate.js": "bc61acac0c9e763535a9da3a4341a1ba830147f31615d39f9431228c6ce65bcb",
  "src/demonFinalTaskCore.js": "d57117180fbb23a9960c21729af9b9e463aa8b4b7c574d30e708b88990fc128a",
  "src/devService.js": "74aed8ab9f20de8436fbceebfdab4f7d6c31315d3ee9cb131192fd14b4667b03",
  "src/dialogFocus.js": "881302a98632eccff28358b007dc342742d19d3429428463f952bb88c9791dd7",
  "src/encounter-ceremony.css": "e7d557c62e64172f97b5d847acb17a9e7733b003d6c5b1cbeae14b6de03b37cb",
  "src/encounter-invitation.css": "cf13a4781969625e00fc683003c6baff09d2c86251f04036d2cbd61a11984c2c",
  "src/encounter-view.css": "afa6288fbeab9271694a216b1290d4b2a5eabca7eb8d08f1f7d8a55d9b6a1bd6",
  "src/encounterCeremony.js": "58d9f08418b4986c809411bf55ce84956c872464ae127d953617f3b6237e9731",
  "src/encounterEconomyCore.js": "dfeff3c9127f00e4cba4e00f0c6828763a50a295b0a78db84e20f432aa23c228",
  "src/encounterEconomyService.js": "007d45a99a071b2b2e6b8f28537de0cad9d0128ddf4d027ba1f4d15957522840",
  "src/encounterScenery.js": "3dc5476f5ede488a7aa35bd8b4d2b0ab3c4ac33cc05b3d2b6eef3b3eb62de736",
  "src/encounterView.js": "40174a7f63979b2deb89dc7cfb96abc2be8987c34118e0eafd5c81933d72e2bf",
  "src/encounterViewModel.js": "1e4fca3200539c5d3a63d63acd00340d5d5c6940430c12268c9cdf95325a414a",
  "src/errorLog.js": "414fd8670c70fc80fb5b66e4b2097eca2c543a3f445fd8be62839c074f6f1baf",
  "src/expeditionGameplay.js": "49518eb6bf54a51ac871b2cbbcff9baf81ed6fd295466edd71de58508aa842a0",
  "src/expeditionService.js": "201eb9922736d0870f976ba167681a803efca23b0a5e3eb3ab6f4f3b9fe49a6e",
  "src/expeditionStatusService.js": "3682a96f9df5da9b34b0afb6c944a191a76a8de40b7bbc6b5226636b69b883c4",
  "src/explorationService.js": "dc7260d90cb4a533033608a99e48d44f5b1cbcf2458898ba053168a0ee414e34",
  "src/feedbackConfig.js": "a4d552eeb313ec5c6fb34f04b37b4132e7320c1de71f4a40fd138bdd8eab3827",
  "src/feedbackController.js": "259d2ce58a2749f70971cb6a4846a8adfb1c379b30cbffff92b36e4be5e22c7e",
  "src/feedbackService.js": "57fea17b5acecff71360e38a25e61e198c68be8cbb92bdff2a6e4d2701a4a10f",
  "src/filterGestureController.js": "afe7a9bc2b5ad8f11d25bdd241f88daa07367ceb070db1db512a3f937bcce64c",
  "src/font-size-settings.css": "c726cdeea1da35ab3a05c5379928a91c5e58412c25de821310ef089ed351f60e",
  "src/gachaService.js": "ab98b06e464363f439ecb3ac4a70e080e3ded77851fdba35a34ff22594cfd3c6",
  "src/gachaTransactionCore.js": "fc38c85989dd14a74a77f49839e0624693e1ee335aa236a1c5f49225ae0a2593",
  "src/glacierArrivalScene.js": "8ec042f1f818f0ed72a44bfe951b35a17d74a20dbc5d5ab275a3597b175f9b52",
  "src/guided-onboarding.css": "7530687e8078deb905d86254713b4535576b3a47a1df81673676df7fcc6d8282",
  "src/guidedEducation.js": "e26d343249d9a5e724418bc7e6f6c676ea541833184e9616ed7c651a1d83d3ee",
  "src/guidedOnboardingController.js": "4bcdd90280e408f546bbce8fef529961f6b2ae02c07e155b2cc41163ef4b030b",
  "src/guidedOnboardingCore.js": "0810901552a5bb3f97a83ec01d7bc29fc40647fabbcb70195625a7b6e75d1287",
  "src/guidedOnboardingService.js": "24ed20f8676617777321ebaab58913d447bd2b9dedfaded990fc44357ca1e1a0",
  "src/guidedPageTour.js": "ac30fe4bcb5b38f3774954f1505834a601382c08ba90852de57fddcd979b3048",
  "src/habitService.js": "c5e6e65ee9a450bb3bc4efc811372ce2718baeb49b64712b9d67f1afbcb46a2c",
  "src/healthCheckService.js": "fb5505cb78f639cf2f72508a1e49b6fcf6d7a96df5b00c001b7b95255ac31da4",
  "src/honeylight-sugar.css": "45c4ac8a6949ef219dc8c66e598675342500111b0106b49293fcc0d363faccd8",
  "src/honeylightSugarScene.js": "eb6fb360fa1682afeb34eb1122ac9afacfa3409801562f1b4c2b23117c13c11d",
  "src/iconPresentation.js": "7968b5b39c17d4e912486df1fc912f93c9d368579ee6e16875ab069e53b46e2a",
  "src/imagePreloadService.js": "9d4d35d3522c30e3c85510396f3a8548d3856f3d5a719d54c150c068391f3d0b",
  "src/invitationPresentation.js": "c70393d4d1b5b55e42409f611de8eb9a6841bb9515b9e5e3de92eb474f345757",
  "src/lionheart.css": "456ddb923dc626c5e2e4bd6bffa1dc0ca1a85a3579ae73c5abaaaa2d41724511",
  "src/lionheartScene.js": "891fb337b367df2a96ea208e92923ac026f2087dcf6d52125e973d9215282236",
  "src/localArtPreview.js": "b8eb54d0f97c35874497752eb2b202c85ba03d3a14ac656d69810cb15c39edae",
  "src/loreService.js": "1ea30235cd11a9fb76be1d4dfe5574e2ddf989d57fc04a640370d92e46edb91c",
  "src/mailboxSchema.js": "89498e84f141cb13d6c277f07fc8c394cabc9d61872599c2f08b46b0da9e1065",
  "src/mailboxService.js": "f3657d51d6d29543f50ed6571ff2d7a93443c976e9bda1f1c40d0864e9b972c4",
  "src/nativeBridge.js": "1349535b56d52c5c6a7bad451e6f6e5eee7a26da7b0f5184b86ea57102e9bc1a",
  "src/onboardingController.js": "0e0a584e3ec1bb437f63a58de0bb2eade1e89290662ff48b3f46b1ef780b0f5a",
  "src/onboardingLessons.js": "ca466bc06626f41db3e3cfd32dc5b5820fedd08f2c67270a8151efc31b61e0cf",
  "src/onboardingService.js": "5eb0fd096679813b211fc922c5b1d50eab7a6a809a4837b82ebde92b8f90067c",
  "src/perfDiagnostics.js": "ad7c93572b070e9781236930f7fbe00c7ef0913428c7768004175508730f360a",
  "src/pet-awakening.css": "aaf8b55b11c1e694c13d71d4840e7fda4048480147de12c2fcfd452c3e5e0b32",
  "src/petAwakeningCatalog.js": "98170beb2004692b6c3707c90b66db86bc7867f422622fe60e9dfbdf10bd6a9e",
  "src/petAwakeningController.js": "16def7b7589f35679459df20e5723048e7860355c4c1c506d791e279784b9527",
  "src/petAwakeningCore.js": "1f65a2568983151ef29ecb973e7d0e89d7efab70ea86fa71303742473b933986",
  "src/petAwakeningProfiles.js": "23c3fcfad45319dfdb2abb4e3a278644cf2e78726dc23744df38b7523c55b1c0",
  "src/petAwakeningScene.js": "119b9458930c7f6353952f80e3622c520b4f0d6a553516d27ce8dd93418b758c",
  "src/petAwakeningService.js": "88dd27671c10feb3896ef0689cf2a5a41edb3c59a9702ff2c3ce3c6e94f927fd",
  "src/petAwakeningView.js": "61b43aa8199135cf6c921acdb8072a86bc75194b24b563d8291274820903f006",
  "src/petDataSchema.js": "4e1544021a6e98719e7483876cae0aa8f51b899a64df826efcbc9d3af2a555de",
  "src/petPoolFilter.js": "c87b18d9fc84ae173f7648f30e05484b56afb0ff676c465c40b945509602e4f8",
  "src/poolAwakeningController.js": "811e8161b8a80d7cae499c17204d443aab8538104092b6a065ca30fafc049137",
  "src/poolAwakeningPreview.js": "9b8a5b6c4aea6ca36fcab3683077519b56873e927c3931cdb7513a73c7c5c6df",
  "src/poolContentContract.js": "70e439d0c4772dcd6d15b8c395a36b67d19b8f24260af6d4fd79ac7cdd087a4d",
  "src/poolDebutService.js": "ca57614cf5b132ace575c58b5179be397644a0c93c72d013367b01fe18b906aa",
  "src/poolDirectory.js": "4b68eed5698235fab0034343a5dfd345ef862884e8fbbdafa8516e74b79963ac",
  "src/poolPresentation.js": "1b7ea97b7009174328e43af8050d4f0d67da9e535fd222e8ade2c544a05661bf",
  "src/poolRecommendation.js": "f52e7a9a0dbfc6f2007504524f5c1505b359e6786bb5c78523cdf979512354ff",
  "src/poolUnlockCore.js": "1ed3097a6ea2f48394ac863b84b9c897a019d485cc0211ba5928362db681b72a",
  "src/poolUnlockService.js": "885d03f68a17a8d7a9b614227a613b2c7b6b8e6ebb450393408c8e0aa1a7f7fc",
  "src/preferencesService.js": "baf3710cd770f5e7a1e76c0125ad354f63e7e0cbf29525b0d3baae6b421f52e3",
  "src/questIcons.js": "fa0cb1d6c415b3c5812a5d769526050f3fe7fde36a3734d49e09cc622e5959ba",
  "src/questService.js": "285bdbe4e15cd931e56a7126b7e6d14d8257df9baa61ff3568f9e7b7be813389",
  "src/quick-voice.css": "4fc86edec4429047455cba3b07ea2e5e78ec0106e7aebe0365f0b9c08e802cd7",
  "src/quickVoice.js": "6e697259ae140f9f40492562729f3f81135e5e08ef1157542ab0a582be0ce665",
  "src/releaseCatalog.js": "a390a99ff3bd22630436819f9b9502e44db09cd5c4add9cb4c6d85f5093fdbd0",
  "src/releaseProfile.js": "a94f8a962eb5433794105232f6e2c3667766e09957a040ef98060f722ece7b3e",
  "src/reminder-settings.css": "3332cd2d88fc7e6db264d4b5669ed43334fb48e0538629b0f15afbeeb5c6c88d",
  "src/reminderController.js": "0c31d1153a8dd7e4130c38f5a76eda041f641baf4fea0dc6742ca843f2d66369",
  "src/reminderRules.js": "33a762131288af03d1038797e79202954638a5d320c791d3c4f2ab0a4b301473",
  "src/reminderService.js": "0020c416619da8746f8dcd8e0d4105b20698d6974aa74fcc6ff8f2101e2b8ed2",
  "src/rewardClaimService.js": "29ae2367857051a8cbda70ae155729f3f887e08815c8ce43681ad888623a9de1",
  "src/rewardService.js": "277dfcbb69925fec8918d963c249643c568ad6df77b3b0af918e100d3922b56c",
  "src/seniorMode.css": "006b04e810136c10603c09dd4ac2a0c833e5893d2b09677dce4bdeb3b9222752",
  "src/seniorModeController.js": "aff6b15557e912727cbd84c196fb2d685805d8c7a151c587556f9f7103e0a156",
  "src/shareService.js": "6f2129e111c22b503e655b34c12c67580ae7c9d3955c2957cf4f687b95c6019a",
  "src/standardUrCarousel.js": "56308c2a332701235e1793daf04f606db921c3756bf8574f1364741bc5437c25",
  "src/styleParts.js": "ba1d9039f1ec448b8ada7c461cfbf43c13beb2b82cff453eb34a2d800dbd5099",
  "src/styles/01-foundation.css": "69de3e8c1d3798aa059f8e3c6ad826c5e1ab280add4f06365ebbdb89d565f826",
  "src/styles/02-core-views.css": "cff83639fbcc7c96040633c82efb7ea084a1f0849a9122324ca2f2a17f3de7c1",
  "src/styles/03-tasks-habits-workshop.css": "2d3bab31f45d2c7422bf9fa213d912bbcbbdd35a0bb37d9860dbd3d0f188e547",
  "src/styles/04-toasts-forms-themes.css": "8381c9abdcf685c58e1ad02aa61daa0c61bff3f3794e077c27e0219410031608",
  "src/styles/05-daily-blessing-wheel.css": "92dc1932850f4d4128f6d0f133b6b40c2fb19aa49dafd31b86424177acd22a10",
  "src/styles/06-rates-summon-reveal.css": "1e0d7893056c52f5c9883029bbf0e1aecc99c70b1e0ea99ab1411d910eb35061",
  "src/styles/07-quests.css": "881c816da72a50d45b029e3696e664e699a7b36dcc16b8b569cf243cd8a68b71",
  "src/styles/08-bond.css": "a7c59185320a8ef36fc9fe8989a09e6e4ce6c65bc6bca87cd4f8511e71568170",
  "src/styles/09-exploration-expedition.css": "5df45d4ae12cd0d7440dd193ee2a49479fe81028a0339eed2b90f6eeffebaaf8",
  "src/styles/10-typography-collection.css": "ebcb2b95c7db4a987c26748979b65265fe45af65993bf46b8d4dc971d24dd0f8",
  "src/styles/11-mailbox-handbook.css": "73e0f90cd7f2fd4e632242ebf9e3715dd676b7136f901a6afe2378f31086104a",
  "src/styles/12-themed-pools.css": "bcf4d3a0fa11956140c709f8a08909d79e0a3a000300d50fb6b130c87cae4839",
  "src/styles/13-feedback-workshop-camp.css": "64cbe7e855dcf3d68ef8f7966d0a29f4c2c8f007e712ff7a1451a4c5732189c2",
  "src/summon-polish.css": "bd4b0859eacb1d2b0e90c47e6ce6958b5414847d5f90673da74b835cc8e35654",
  "src/summonRevealService.js": "97b914d914bfb8fab9e9c39a6bf6a81c57f973e24f6d51c521ccb931a629a564",
  "src/summonTiming.js": "3f37ab1839c7444af3d251a685ffaff40f422998df1492f468558c97efe78409",
  "src/swordwild-shanhe.css": "1648f5b95e86b0b25fefd917c413ef9cdf77a89e92d17ff69ca0563e84a23c90",
  "src/swordwildShanheScene.js": "4b47bbcec336a3942e0b78731888abd8694f8cd6e169b886872721f8cbb1fda5",
  "src/taskFilterService.js": "74b462a3acf51be2caba231feb04d9051e79b88a28c2c1cc850f50245a0fcce7",
  "src/taskMigration.js": "de4b1390cca6fd3661c591ea76012e7662de0961c86406f4d696fb94b821d8ad",
  "src/taskService.js": "299b5327e07050fa08aea70456c45dc59e71fcf5d82b4de968a75bffd6fccdf3",
  "src/taskStatsService.js": "c07ac5d6c718b362768c86b74c9a1532a19c3112564c18ec13b3b43620cf19f9",
  "src/taskVoiceInput.js": "fcc6b33197384e347739fd0eeefc7a691258e492a17e0c4c5b3e9d8474921556",
  "src/taskWizard.js": "3d0571f251f2c8ea3cb90886da91e658ac4e7957e5c52b510efd8d76284fc2e5",
  "src/theme-refinements.css": "021d4837898eb55de0efc66c893a798c785be31af464ba225fcd237a52615d46",
  "src/theme-system.css": "95b769c1c403126929cd13104f212c2a31cfc4b4a930791a2f15b45785ec840c",
  "src/themedSummonController.js": "fb90c86a0abc6462e27d26d6c1043ccb0680e941010c7b1df65bfd86dd532847",
  "src/themeRegistry.js": "1a48b57e0204a71f8a18ae58d939a1a27ae394604544208c673e36c47ad4a90c",
  "src/themeTokens.css": "054866884d3a1ec208fa5ba7bb80231c52a89da169baae9a7a22e44217df31d5",
  "src/todayHabitsView.js": "5045029495d905c7252b142765c2ee8db884090011902fbfd9f0a448624bec4c",
  "src/twilightPresentation.js": "6d70ca746d3ff4f2436f000d9cb522f7377a763007d63e1bec6e0a591214eb83",
  "src/ui-polish.css": "eac13acfb68e2842ea865600f3b73ad9d5f4b729f46b774ad590aeeab4691fac",
  "src/ui.js": "603439ebde5ccbdde3093e6475645f4e8e3cf9feca53cb99a82a635ab730a346",
  "src/ui/achievementsView.js": "dec046e707839a49d2c2d32c785e08235001e363e3b58fc77c6a81aefc93baf9",
  "src/ui/collectionView.js": "6ed87725bf8bdcf1cfcb8b527ee7cd0445bbe1bd0c0102879008e4eb0c31e4ca",
  "src/ui/companionView.js": "362410485cb4686208b7ea2866bd236bc5f75c49627bea6a6ceb32f5686eb2a8",
  "src/ui/dailyBlessingView.js": "28f23283f0258cfb9a9abc211e19e3d5155825ab860ca46d8cfde84e208fc961",
  "src/ui/dailyWheelView.js": "2084cbe2a782fa724d321e48787d83bc7cf47fb5626d715f954ac5e38528e7f6",
  "src/ui/expeditionView.js": "56bad83a638d0312d8222517795f45358747ef851806a950b03ab69083e56151",
  "src/ui/gachaView.js": "aee6c7dacc0788e51f96fa36c577f0bc2d4dc11aac9d694f040583b045154467",
  "src/ui/habitsView.js": "7d04fa4d6892f54de5ff5a3fa948622f94365c13b141802ec64cc55bf1c4f8f0",
  "src/ui/handbookView.js": "96683c190c90c9fcd6d146eaf2f5dec6295a419bec644bf4ffaf832eafce2a0a",
  "src/ui/mailboxView.js": "ab29c2eed1d9013e46b08abc84a3c5103ef2e1d6b7ef55c89f456dd452d01e1b",
  "src/ui/modalHost.js": "6355305a252d354eca1abfd92a8b9cb43fa96ca034f087a2c58f9f1bf96aec3a",
  "src/ui/quickVoiceView.js": "b41fb1dccf81f36db946c779c5cb3b98e5e048dc662da581772d6ab1599149f5",
  "src/ui/settingsView.js": "beb22a39b3c2866f9bd9d374856ef799b69f1963cadf10b335092a6c090c3289",
  "src/ui/taskFormView.js": "4005e9f31ee4d6102b7d147b2f7ead72a8e4928902377f44bdbe459f9f8aa1fe",
  "src/ui/taskListView.js": "fe318f1c17581d96e95c1af4ff853412d26d3f9eccbe389f62efaf88127955db",
  "src/ui/webMigrationView.js": "396086dac4bb3501cbb902fef2d40ea068ac2d8acd73b385ca38560a4121f38c",
  "src/ui/weeklyReviewView.js": "2d63a5a56192f437b5933040232680a8dcfd3ac9242ee33e39969d3dcb8d80f4",
  "src/ui/workshopView.js": "ac764c521436815acb3869351c00e69a10a7cbcd1c00aaeb5d5cca2f544b4dcc",
  "src/uiHelpers.js": "97e36e6f1b64b18e4453a94cec7f943990ff9fac3bff399ec268f7a89de0c9e4",
  "src/uiSourceParts.js": "23cfc216edd6bde000a5e5a00b9604c4c0dcf6edd7f62ade18e4bae192a2e7bc",
  "src/updateActivity.js": "2cb4d2e9f5b4a77b0e92cd2793e577578914cdc4a5f4c2aee3410838a22526b5",
  "src/updateController.js": "fcf45665a4ed9fa8dc8e14f719e65320ce2de90fe877cfa87245387cfafaa8e4",
  "src/updateProtocol.js": "df73542b7899fb473b91f913bc890463331fbb0832db56289f783c33e9d588a0",
  "src/version.js": "2bd2838957f4f6060e263e37bde585406d6794222e0789f8e556c473add0d00d",
  "src/webToAppMigration.js": "49aab60cdacd89e84f4ddbf42f0e04a62bd0f1c760ebfc0291d05509c1e23b11",
  "src/weekly-review.css": "540ee55a1d22b0c6dac9a9bf32930c855b168e5359f6f6e34382de3dc16628f1",
  "src/weeklyReviewService.js": "4e1681fd26d685cff09a929938c0a926adeb61dd602ef773997c03b19d45d25d",
  "src/widgetSnapshot.js": "46b12a40a15cf5605d6acbba1b3b6095db7e5ed8b85406064c2d60d00f214e3d",
  "src/workshopGiftView.js": "7465474a1ac4ed2270e2d1fe9106760ec3855ea1ca48958c0762861d3ce25f09",
  "src/workshopService.js": "ee65a2302f685cf7492f00f07e35900b750ff697903f21159e899265e98eaac6"
};

/** 需要預快取的資源（相對於 SW 所在目錄） */
const PRECACHE_URLS = [
  "assets/brand/questnote-icon-180.png",
  "assets/brand/questnote-icon-192.png",
  "assets/brand/questnote-icon-32.png",
  "assets/brand/questnote-icon-512.png",
  "assets/brand/questnote-icon-maskable-512.png",
  "assets/brand/questnote-icon-master-1024.png",
  "assets/expeditions/astral_rift.webp",
  "assets/expeditions/aurora_feast_garden.webp",
  "assets/expeditions/cloudrest_trail.svg",
  "assets/expeditions/cloudrest_trail.webp",
  "assets/expeditions/darkcrown_border.webp",
  "assets/expeditions/harvest_fields.webp",
  "assets/expeditions/lava_rift.webp",
  "assets/expeditions/lionheart_city.svg",
  "assets/expeditions/lionheart_city.webp",
  "assets/expeditions/machine_ruins.webp",
  "assets/expeditions/mist_forest.webp",
  "assets/expeditions/polar_shore.webp",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/lucide/LICENSE",
  "assets/icons/lucide/provenance.json",
  "assets/scenes/garden-graywolf.webp",
  "assets/scenes/night-graywolf.webp",
  "assets/scenes/twilight-graywolf.webp",
  "data/achievements.json",
  "data/bond-stories.json",
  "data/categories.json",
  "data/craftables.json",
  "data/dailyWheelRewards.json",
  "data/expeditions.json",
  "data/gift-affinities.json",
  "data/materials.json",
  "data/pet-awakening.json",
  "data/pet-series.json",
  "data/pets-lore.json",
  "data/pets.json",
  "data/pools.json",
  "data/releases/53f3cf3aea133c9186cbaf0396dfd54241d5fb0bb4debbf57601cd4d2c944046/catalog.json",
  "data/titles.json",
  "index.html",
  "manifest.webmanifest",
  "src/achievementService.js",
  "src/adventureHandbookService.js",
  "src/app.js",
  "src/appBadge.js",
  "src/aurora-fairy-feast.css",
  "src/auroraFairyScene.js",
  "src/backupSchema.js",
  "src/backupService.js",
  "src/bond-journey.css",
  "src/bondJourneyController.js",
  "src/bondJourneyCore.js",
  "src/bondJourneyService.js",
  "src/bondJourneyView.js",
  "src/bondStoryCatalog.js",
  "src/bootstrap.js",
  "src/bootstrapRecovery.js",
  "src/campService.js",
  "src/categoryService.js",
  "src/chaos-demon-court.css",
  "src/chaosDemonCourtScene.js",
  "src/collectionMilestoneService.js",
  "src/collectionService.js",
  "src/companionDialogueService.js",
  "src/companionService.js",
  "src/daily-race.css",
  "src/dailyCheckInService.js",
  "src/dailyEncounterCore.js",
  "src/dailyRaceController.js",
  "src/dailyRaceCore.js",
  "src/dailyRaceScene.js",
  "src/dailyRaceService.js",
  "src/db.js",
  "src/deferredRenderGate.js",
  "src/demonFinalTaskCore.js",
  "src/devService.js",
  "src/dialogFocus.js",
  "src/encounter-ceremony.css",
  "src/encounter-invitation.css",
  "src/encounter-view.css",
  "src/encounterCeremony.js",
  "src/encounterEconomyCore.js",
  "src/encounterEconomyService.js",
  "src/encounterScenery.js",
  "src/encounterView.js",
  "src/encounterViewModel.js",
  "src/errorLog.js",
  "src/expeditionGameplay.js",
  "src/expeditionService.js",
  "src/expeditionStatusService.js",
  "src/explorationService.js",
  "src/feedbackConfig.js",
  "src/feedbackController.js",
  "src/feedbackService.js",
  "src/filterGestureController.js",
  "src/font-size-settings.css",
  "src/gachaService.js",
  "src/gachaTransactionCore.js",
  "src/glacierArrivalScene.js",
  "src/guided-onboarding.css",
  "src/guidedEducation.js",
  "src/guidedOnboardingController.js",
  "src/guidedOnboardingCore.js",
  "src/guidedOnboardingService.js",
  "src/guidedPageTour.js",
  "src/habitService.js",
  "src/healthCheckService.js",
  "src/honeylight-sugar.css",
  "src/honeylightSugarScene.js",
  "src/iconPresentation.js",
  "src/imagePreloadService.js",
  "src/invitationPresentation.js",
  "src/lionheart.css",
  "src/lionheartScene.js",
  "src/localArtPreview.js",
  "src/loreService.js",
  "src/mailboxSchema.js",
  "src/mailboxService.js",
  "src/nativeBridge.js",
  "src/onboardingController.js",
  "src/onboardingLessons.js",
  "src/onboardingService.js",
  "src/perfDiagnostics.js",
  "src/pet-awakening.css",
  "src/petAwakeningCatalog.js",
  "src/petAwakeningController.js",
  "src/petAwakeningCore.js",
  "src/petAwakeningProfiles.js",
  "src/petAwakeningScene.js",
  "src/petAwakeningService.js",
  "src/petAwakeningView.js",
  "src/petDataSchema.js",
  "src/petPoolFilter.js",
  "src/poolAwakeningController.js",
  "src/poolAwakeningPreview.js",
  "src/poolContentContract.js",
  "src/poolDebutService.js",
  "src/poolDirectory.js",
  "src/poolPresentation.js",
  "src/poolRecommendation.js",
  "src/poolUnlockCore.js",
  "src/poolUnlockService.js",
  "src/preferencesService.js",
  "src/questIcons.js",
  "src/questService.js",
  "src/quick-voice.css",
  "src/quickVoice.js",
  "src/releaseCatalog.js",
  "src/releaseProfile.js",
  "src/reminder-settings.css",
  "src/reminderController.js",
  "src/reminderRules.js",
  "src/reminderService.js",
  "src/rewardClaimService.js",
  "src/rewardService.js",
  "src/seniorMode.css",
  "src/seniorModeController.js",
  "src/shareService.js",
  "src/standardUrCarousel.js",
  "src/styleParts.js",
  "src/styles/01-foundation.css",
  "src/styles/02-core-views.css",
  "src/styles/03-tasks-habits-workshop.css",
  "src/styles/04-toasts-forms-themes.css",
  "src/styles/05-daily-blessing-wheel.css",
  "src/styles/06-rates-summon-reveal.css",
  "src/styles/07-quests.css",
  "src/styles/08-bond.css",
  "src/styles/09-exploration-expedition.css",
  "src/styles/10-typography-collection.css",
  "src/styles/11-mailbox-handbook.css",
  "src/styles/12-themed-pools.css",
  "src/styles/13-feedback-workshop-camp.css",
  "src/summon-polish.css",
  "src/summonRevealService.js",
  "src/summonTiming.js",
  "src/swordwild-shanhe.css",
  "src/swordwildShanheScene.js",
  "src/taskFilterService.js",
  "src/taskMigration.js",
  "src/taskService.js",
  "src/taskStatsService.js",
  "src/taskVoiceInput.js",
  "src/taskWizard.js",
  "src/theme-refinements.css",
  "src/theme-system.css",
  "src/themeRegistry.js",
  "src/themeTokens.css",
  "src/themedSummonController.js",
  "src/todayHabitsView.js",
  "src/twilightPresentation.js",
  "src/ui-polish.css",
  "src/ui.js",
  "src/ui/achievementsView.js",
  "src/ui/collectionView.js",
  "src/ui/companionView.js",
  "src/ui/dailyBlessingView.js",
  "src/ui/dailyWheelView.js",
  "src/ui/expeditionView.js",
  "src/ui/gachaView.js",
  "src/ui/habitsView.js",
  "src/ui/handbookView.js",
  "src/ui/mailboxView.js",
  "src/ui/modalHost.js",
  "src/ui/quickVoiceView.js",
  "src/ui/settingsView.js",
  "src/ui/taskFormView.js",
  "src/ui/taskListView.js",
  "src/ui/webMigrationView.js",
  "src/ui/weeklyReviewView.js",
  "src/ui/workshopView.js",
  "src/uiHelpers.js",
  "src/uiSourceParts.js",
  "src/updateActivity.js",
  "src/updateController.js",
  "src/updateProtocol.js",
  "src/version.js",
  "src/webToAppMigration.js",
  "src/weekly-review.css",
  "src/weeklyReviewService.js",
  "src/widgetSnapshot.js",
  "src/workshopGiftView.js",
  "src/workshopService.js"
];

function resolveUrl(path) {
  return new URL(path, self.location.href).href;
}

function isGlobalMailboxRequest(url) {
  const expected = new URL(resolveUrl('data/global-mailbox.json'));
  return url.origin === expected.origin && url.pathname === expected.pathname;
}

function getMailboxCacheRequest() {
  return new Request(resolveUrl('data/global-mailbox.json'));
}

/** 快取比對（忽略 URL query，避免 ?v= 導致離線載入失敗） */
async function matchCached(request, cacheName = CACHE_NAME) {
  const cache = await caches.open(cacheName);
  const direct = await cache.match(request);
  if (direct) return direct;

  const url = new URL(request.url);
  if (!url.search) return null;

  const requests = await cache.keys();
  for (const req of requests) {
    const stored = new URL(req.url);
    if (stored.origin === url.origin && stored.pathname === url.pathname) {
      return cache.match(req);
    }
  }
  return null;
}

function isMutableAppAsset(pathname) {
  return /\.(js|css|json)$/i.test(pathname)
    || pathname.endsWith('/manifest.webmanifest');
}

function isPetImagePath(pathname) {
  return pathname.includes('/assets/pets/');
}

function isImageAsset(pathname) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(pathname)
    || pathname.includes('/assets/');
}

async function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(request, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 全域信箱 JSON：Network First + timeout + runtime cache fallback
 * 寫入時使用固定 URL key，避免 ?t= 造成無限 cache key
 */
async function networkFirstMailbox(request) {
  const cache = await caches.open(MAILBOX_RUNTIME_CACHE);
  const cacheKey = getMailboxCacheRequest();

  try {
    const response = await fetchWithTimeout(request, MAILBOX_FETCH_TIMEOUT_MS);
    if (response.ok) {
      await cache.put(cacheKey, response.clone());
      return response;
    }
    throw new Error(`Mailbox HTTP ${response.status}`);
  } catch {
    const cached = await cache.match(cacheKey)
      || await matchCached(request, MAILBOX_RUNTIME_CACHE)
      || await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({
      schemaVersion: 1,
      generatedAt: null,
      messages: [],
    }), {
      status: 503,
      statusText: 'Mailbox Offline',
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** 有網路時優先取新版，離線時 fallback 快取 */
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch {
    const cached = await matchCached(request, CACHE_NAME);
    if (cached) return cached;
    if (request.destination === 'document') {
      const page = await matchCached(new Request(resolveUrl('index.html')));
      if (page) return page;
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/** 寵物圖片：runtime cache-first，離線仍可顯示曾看過的圖 */
async function cachePetImage(request) {
  const cache = await caches.open(PET_IMAGE_CACHE);
  const cached = await matchCached(request, PET_IMAGE_CACHE);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const fallback = await cache.match(request);
    if (fallback) return fallback;
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/** 其他圖片：快取優先，離線仍可顯示 */
async function cacheFirst(request) {
  const cached = await matchCached(request, CACHE_NAME);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function verifiedPrecacheResponse(path) {
  const request = new Request(resolveUrl(path));
  const cached = await matchCached(request);
  if (cached) return cached;
  // Older workers on a sibling scope and browser eviction can remove our cache.
  // Recover only bytes belonging to this exact release; never trust the live URL alone.
  const expected = PRECACHE_HASHES?.[path];
  if (BUILD_PROFILE && /^[a-f0-9]{64}$/.test(expected || '')) {
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (!response.ok) throw new Error('Required asset unavailable');
      const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== expected) throw new Error('Required asset belongs to another release');
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    } catch { /* Keep missing, offline or mixed-generation responses out of the cache. */ }
  }
  return new Response('Verified application cache unavailable. Reconnect, close all QuestNote windows, and reopen.', { status: 503 });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (BUILD_PROFILE && new URL('./', self.location.href).pathname !== BUILD_PROFILE.scopePath) {
        throw new Error('Release scope mismatch');
      }
      // Do not touch the cache until every required file has been fetched and verified.
      const entries = await Promise.all(PRECACHE_URLS.map(async (path) => {
        const url = resolveUrl(path);
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok) throw new Error(`Required asset unavailable: ${path} (${response.status})`);
        // Drain each body immediately: no-store responses can otherwise occupy all
        // HTTP connections while Promise.all waits for the remaining response headers.
        const body = await response.arrayBuffer();
        if (PRECACHE_HASHES) {
          const digest = await crypto.subtle.digest('SHA-256', body);
          const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
          if (hash !== PRECACHE_HASHES[path]) throw new Error(`Required asset mismatch: ${path}`);
        }
        return [url, new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })];
      }));
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(entries.map(([url, response]) => cache.put(url, response)));
      // Natural activation waits until the previous worker has no clients.
    })()
  );
});

// Legacy SKIP_WAITING stays ignored. Only a deliberate, single-window update
// can activate a fully installed generation; other windows keep their edits.
self.addEventListener('message', (event) => {
  if (!['QUESTNOTE_UPDATE_INFO', 'QUESTNOTE_APPLY_UPDATE'].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    const reply = (data) => event.ports?.[0]?.postMessage(data);
    const scope = self.registration.scope;
    if (!event.source?.id || !event.source.url?.startsWith(scope) || !BUILD_PROFILE) {
      reply({ status: 'unavailable' }); return;
    }
    if (event.data.type === 'QUESTNOTE_UPDATE_INFO') {
      reply({ artifactId: BUILD_PROFILE.artifactId, scopePath: BUILD_PROFILE.scopePath }); return;
    }
    if (event.data.artifactId !== BUILD_PROFILE.artifactId
      || !self.registration.waiting || self.registration.waiting.scriptURL !== self.location.href) {
      reply({ status: 'unavailable' }); return;
    }
    // Eviction may happen after install. Do not switch to an incomplete shell.
    const cache = await caches.open(CACHE_NAME);
    const complete = await Promise.all(PRECACHE_URLS.map(async (path) => {
      const response = await cache.match(resolveUrl(path));
      if (!response?.ok) return false;
      if (!PRECACHE_HASHES) return true;
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      return hash === PRECACHE_HASHES[path];
    }));
    if (complete.some((ok) => !ok)) { reply({ status: 'unavailable' }); return; }
    // includeUncontrolled is needed because a waiting worker has no clients yet.
    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter((client) => client.url.startsWith(scope));
    if (windows.length !== 1 || windows[0].id !== event.source.id) {
      reply({ status: 'other-clients' }); return;
    }
    reply({ status: 'accepted' });
    await self.skipWaiting();
  })().catch(() => event.ports?.[0]?.postMessage({ status: 'unavailable' })));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => (
            key.startsWith(BUILD_PROFILE?.cacheNamespace || 'questnote-preview-')
            && key !== CACHE_NAME
            && key !== PET_IMAGE_CACHE
            && key !== MAILBOX_RUNTIME_CACHE
          ))
          .map((key) => caches.delete(key))
      );
      // Do not claim already-open uncontrolled pages in the middle of an operation.
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const base = new URL('./', self.location.href);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  const relativePath = url.pathname.slice(base.pathname.length);
  if (/^(devtools|scripts|content|reports|docs)\//.test(relativePath)) return;
  // The worker script is never precached; the App health check reads it from the network,
  // as the browser's own update check does.
  if (relativePath === 'service-worker.js') return;

  if (isGlobalMailboxRequest(url)) {
    event.respondWith(networkFirstMailbox(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(verifiedPrecacheResponse('index.html'));
    return;
  }

  if (PRECACHE_URLS.includes(relativePath)) {
    // A verified application generation is immutable; online requests must not mix releases.
    event.respondWith(verifiedPrecacheResponse(relativePath));
    return;
  }

  if (BUILD_PROFILE && isMutableAppAsset(url.pathname)) {
    event.respondWith(Promise.resolve(new Response('Asset is outside this release', { status: 503 })));
    return;
  }

  if (isPetImagePath(url.pathname)) {
    event.respondWith(cachePetImage(request));
    return;
  }

  if (isImageAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirstWithCache(request));
});
