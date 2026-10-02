/**
 * QuestNote Service Worker — V3.5.10 awakening guide
 * 快取 App Shell 與靜態資源，支援離線使用
 * data/global-mailbox.json 使用動態 Network First，不進 App Shell precache
 * 作者本機工具（mailbox publisher／pet series builder／summon preview）原始碼不得加入 App Shell precache
 * 寵物圖片不得加入 App Shell precache
 */

const CACHE_NAME = 'questnote-preview-app-917cbac98c8826aa75823d2bdeb4156d37aeafca709f54fbb21d679f5afdb8fd';
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
  "artifactId": "917cbac98c8826aa75823d2bdeb4156d37aeafca709f54fbb21d679f5afdb8fd",
  "sourceCommit": "8c9a3edae21fbad75c926cfb337d44c660d9a821",
  "scopePath": "/questnote-pwa-preview/v3510-review-8c9a3eda/",
  "runtimeContentSchema": 1,
  "dbName": "QuestNotePreviewDB",
  "cacheNamespace": "questnote-preview-",
  "contentBundleSha256": "57ac7816a6dcc7c9db64373f2f98c2ab8f9b817f592ba186c6d41f2edf7f453d",
  "contentBundleUrl": "data/releases/57ac7816a6dcc7c9db64373f2f98c2ab8f9b817f592ba186c6d41f2edf7f453d/catalog.json"
};
const PRECACHE_HASHES = {
  "assets/brand/questnote-icon-180.png": "568c5f586481050de3c0263794de557f36acb340346eba7db1a9cdc7b000f9bf",
  "assets/brand/questnote-icon-192.png": "7a2c068ff50729b5b68aba6999ffed491234c11a267ddf26ee6f7a5bc0a1db11",
  "assets/brand/questnote-icon-32.png": "0c09c5fef9a6c10f9e10fab7a923d6e84e06972791106a9960bfe062b83952fe",
  "assets/brand/questnote-icon-512.png": "32c505609ea48e4ffab010e2fc53b184441a8bad39d79a45701b658b31040a06",
  "assets/brand/questnote-icon-maskable-512.png": "54dc03e7eb13c3f4714bc276ea2b9bb1313ef171d27e06f6aa1f378931c6f506",
  "assets/brand/questnote-icon-master-1024.png": "45eabdd090efcaee9c9305bca6d559983433c00db41c287f92f66fbac809adf3",
  "assets/expeditions/astral_rift.webp": "343c7342d7156be0fef42c809e0028811a936e2ba478b2785eaf498845dc4d2d",
  "assets/expeditions/cloudrest_trail.svg": "e23e3af8c958f5b17a4bf37b639e0875494359601721e0e23bd674ff765868c9",
  "assets/expeditions/cloudrest_trail.webp": "cf75419ec519bb473ac49f32a6c9af68165550117585ab32649caae2ad9108fd",
  "assets/expeditions/harvest_fields.webp": "6196b84c367ff547d91741d36a57ed06aa34e15464ddafb071d4940d0014a29c",
  "assets/expeditions/lava_rift.webp": "9c14dd71f7752f8ca652992659ba929a094512ec5dc34b4d3806b90dabac904e",
  "assets/expeditions/lionheart_city.svg": "609138d878c764cadb6874de2e6ad38cd4aecb0ef0ed4c4c6cc9d6253db26d29",
  "assets/expeditions/lionheart_city.webp": "283198a96c818efb61bcd8e29a45f8b6109aac408533719b5f913914c85b19bf",
  "assets/expeditions/machine_ruins.webp": "14947a69cacfa25522b20159f5f135734fc5eac25f58a55ae9cb09fc3dccd3b1",
  "assets/expeditions/mist_forest.webp": "d97f0f24d8189b4e882b8da213399b5dba992481d97917c196c5d9bbaded8dc1",
  "assets/expeditions/polar_shore.webp": "e963c18f17a9d60746f2601822f7e0ab18be730629b8de9a3fdf546381891506",
  "assets/icons/icon-192.png": "f47dd61d5e26732d2d20aba9051e7ce922449a6095a3715f7e803a2037857fb1",
  "assets/icons/icon-512.png": "8623855b674e1bb7c10525ff0118b0f4b1da5de551753d724238b62db8c403be",
  "assets/icons/lucide/LICENSE": "6fc5b7332939dd5c61af3a5f97450f7bc05d4a396dd0bc21ac341716b3b05096",
  "assets/icons/lucide/provenance.json": "9c24954b76dc53bae7fa00a2f9f60527197595b815c3e9ca0d86e30b8477a844",
  "assets/scenes/garden-graywolf.webp": "6379b2ad98da53856816d0e11b0048af8a9632002a28c3d362f16fa98c2f5cdc",
  "assets/scenes/night-graywolf.webp": "4dd1183fd2aa0db6ac52f845515c3c8e2e0fe2aced5a4a7d6a66732d5c114edb",
  "assets/scenes/twilight-graywolf.webp": "f8000f2b473ec9eedb3bef4e1a34dc8354351041cfc5eb261d80f98271e84f9a",
  "data/achievements.json": "b7d57297344dc4223a8eefc72d42d9f9cdd44c4f812f1e59b3d7aeb2d592db6e",
  "data/bond-stories.json": "28ec8e13ae77f6582ba068d08bd94407305746c8d59bb51035227e46ce59c045",
  "data/categories.json": "166e8f4de44f41d6ec27b3a6b1780f9cd155aa599371b443c92537949276ebe1",
  "data/craftables.json": "f49345c56b3010389d60ec9c03ec7f44f57b89b9662a2c3ec55d8381fe7fcd73",
  "data/dailyWheelRewards.json": "98f1fb5b3dc5e49fb0815cf60842bc53fd34e604baf540b4d0e2946929030f12",
  "data/expeditions.json": "1dbacba9d13d4addaa03b8348dd2abc42a0d12175bc13176444990041a601984",
  "data/gift-affinities.json": "78237d48ef4403e33458a39e1d5fb477501d0bf119ef956e3b8f917492cb6027",
  "data/materials.json": "ef3aa0d8d7833c5c15504634de7680d43a7404a4012a1377d7d540796125c08c",
  "data/pet-awakening.json": "4c14254cbceee967c88d2e8491fddb2be046603315cd6a9d12830889c6dda169",
  "data/pet-series.json": "b176c710383e78b2e0b6d543bfce5d4244438dfabf2b38806c972f9b555dbc57",
  "data/pets-lore.json": "77dce9e5fbab60b01bf31d5b2e73564c4feeadd8f63380c18bebfec128d6123f",
  "data/pets.json": "a90c6afec9c1d7f95f6dff52020ece50c18d820e5c386a0a067618e9b20b9d00",
  "data/pools.json": "4fd1cdc8674e5592b6b2256603bad59b5bf555650c482237eedb6a86b3867fcc",
  "data/releases/57ac7816a6dcc7c9db64373f2f98c2ab8f9b817f592ba186c6d41f2edf7f453d/catalog.json": "57ac7816a6dcc7c9db64373f2f98c2ab8f9b817f592ba186c6d41f2edf7f453d",
  "data/titles.json": "318675b79872dfabccc4b8beb99f77eb248a40e5e50bbbd4e4dc24886b3a1398",
  "index.html": "02537b43e45b1a197e569f23a2211d45ccd8e604ef4271b5cbddc3f5fe130606",
  "manifest.webmanifest": "f003bc010c3d45e8bb6adff1eafd77d06140722ff929a10b2a575139c3fcea3e",
  "src/achievementService.js": "527b3c8706db9c1b653efe7113eab9d079dff5e77612c8a0dd3b9be20583a288",
  "src/adventureHandbookService.js": "d9dc8d34fc08a83c0c2f36682698fd4d96ebd0852c8cb0fde161a5a718d065b9",
  "src/app.js": "da0e04335e760bd4caa289d89c51f8f54c97b8783f5dcbabded558623b4265be",
  "src/backupSchema.js": "27177b0fe7915c1cce7bf6dc34178009a18c95711fcf1d8442e672b3964779fd",
  "src/backupService.js": "eae7bc45cfc2d45a8d55c579df0a8a713e133d119e1b50ab0bd6744d7ad0e872",
  "src/bond-journey.css": "c5ada471a6ac232974153239c91b6d4628dc5c4decf32b5f256f031f2346ee49",
  "src/bondJourneyController.js": "cfaabae2b18fbf0917cb074e878a11b557801a449a442e71ef9368124aa81805",
  "src/bondJourneyCore.js": "25cf76d84e0849491bc229af3acbe670acfde12cecafe60a916afd5413276c0e",
  "src/bondJourneyService.js": "8c61c444ada34c5d7e1e097943b21b63e2ad5eddbbaa3690f18575d7894b3795",
  "src/bondJourneyView.js": "3805105dee2e07ad228477cf6beba617607fa394fccfbeea951279e78339652d",
  "src/bondStoryCatalog.js": "8f243911238e6f30377c922c787cab9b26b521dbe2fe59a9c145440c57b0a514",
  "src/bootstrap.js": "424349b05fe4e245c0e7e4dc744bea4e2717851666d12ac49f391b715558e07b",
  "src/bootstrapRecovery.js": "7ed8b4ec63dfd3bb1fb908995c435983816c1cb91146842b9792c8ad840d0d2e",
  "src/campService.js": "fee6e4aeafbde7e3d356214099b50523d31089fb00e573c853810c32062a65b1",
  "src/categoryService.js": "8636cdb8453e0a383b813f99d117ead49911353bd6848de05d7f513c28713e32",
  "src/collectionMilestoneService.js": "2f9fe055d3facfb2ce5f6eee96ee0026eb41dab602f27a0eef104402dbe2db5f",
  "src/collectionService.js": "4babc98a28293244bc833788c641fa20dc0aca396eab6aba0f5ba797f35d3da6",
  "src/companionDialogueService.js": "ca84154fbb28fadbaa176f46c02079b8be2c9863f4567d5c2cc6c29347998876",
  "src/companionService.js": "3974b56613aea67e80f7659caa9dbca0d9397f298948f1f98c9e60b8e446d6aa",
  "src/dailyCheckInService.js": "d994210565a779da2265f8a32334dc233a06b4dee037672ef433eb5fa123b62b",
  "src/db.js": "d14cc93d1a97c250ed5aae3bea1521b031575909aaf8a59586f36a1ad6d25b51",
  "src/deferredRenderGate.js": "cbbaf2e401be35eab6d673a935c13fef615286a554937dc497b02c4aa6aca6e5",
  "src/devService.js": "af56b92e6fcf886786f4a41d777dc355c35c0d0bd4b39fd72fc11217c4238dd4",
  "src/dialogFocus.js": "24eb36d909579732f8b9776c4f2e2a3fec8e112d8e96194257b6b16bee49eecf",
  "src/expeditionGameplay.js": "ac8b8ab0401c9d263a4ee359405717f60bc0b8a6e4914b0b1e8b9e4cf69767d7",
  "src/expeditionService.js": "caec8978877213406550d8604dd480f791229e6e4f6ece88505e104836d84722",
  "src/expeditionStatusService.js": "99e665eea61bc0de3f9dcc6a1f1cfe01c17914f27b4bf3ce6347ef7d7302e3e5",
  "src/explorationService.js": "5c6aa487dbfc34b838227550db64bbeb7190b1cd991b445e69e0deae33dccaaa",
  "src/feedbackConfig.js": "77e9eda8efe76ad2ea3d1d216d10be01bb219c954c6c619e925d8e2aeafe49f7",
  "src/feedbackController.js": "9ff600987abd7476b7e6e1bfecb9610ba93588dc0b0930b3c3378c8c78b83e76",
  "src/feedbackService.js": "f96898f3d97d6dc86157f65aae8e8f2b763f222b04bf778aab386276d8bb9310",
  "src/filterGestureController.js": "548300cf1d63d705715fc00668b48b35b5389f351e21ffc3a8e417a350774ad7",
  "src/font-size-settings.css": "47476e661b6f993b8586f37fe5303add68c679793effb9ecaafc2c5b1adde74f",
  "src/gachaService.js": "d631816bfcb980ecbe502cbecf867e0adf65871d00d6ef4e70adce22df9c9bf9",
  "src/gachaTransactionCore.js": "ac2b5db58e2cdec942bb28e0e7b8dae446282fd45518bdf6666fafdc6d579dde",
  "src/glacierArrivalScene.js": "bb3d646a9faaece23f41d29f6248b682fb67e3851e702ac3667f006c02d8b2bb",
  "src/habitService.js": "ccfa3c54ce88d8333fe50e0f4de5926e27d1f8122c919b1bed2b62f160d5e240",
  "src/healthCheckService.js": "83e35ca90fb51b2029a82adac11cb96a4fec40063ce840081a05fb24092e365f",
  "src/honeylight-sugar.css": "5255d8f40152e53c13d9549dda2fe7e26337fb9ddeb98f6cf2e957c34c83be22",
  "src/honeylightSugarScene.js": "c67111490307d36ee858219603f0012ecd633e32f07775983325210466b59562",
  "src/iconPresentation.js": "e093f1b2bfc0c300741644d881c6731f7b758be0e5917cf7cc1a036bd06e8013",
  "src/imagePreloadService.js": "73f6488373daac9b4134c4c7a9549da98f4974d3a4987b4698dc4a56680ad333",
  "src/lionheart.css": "de4f9740573a13db99c23df01ba9a36698615596170332b8913d1261a2d24c57",
  "src/lionheartScene.js": "a9abed170dd1b27e831dac17bd2fc35014d99ed3da4f771f2da1bb3d62eddcd3",
  "src/loreService.js": "2beab9e2c2ab3418b16e638e247d1976c916b537e6a7a21d754751c54336541c",
  "src/mailboxSchema.js": "070e2c731ac75a6bdbecfc24afad986d0357e440d1449c374d898d7e0b0ccd15",
  "src/mailboxService.js": "9e2b08feedc9dc73beb9d18bcff62fd722af276c57ab4f79f9bc8d20eccfa0d0",
  "src/onboardingController.js": "3592185e4c6fba023c65e8d8903ca2e169c092b107b8674e242d688575df872e",
  "src/onboardingLessons.js": "a9438d97708b85dccc2b6faff038a41d2f9051929d8341d28321ff90032bbd31",
  "src/onboardingService.js": "4289008c57efc95843d141a33cb2333c0d9af8c1188a3ba4157e2ab2dfd49a6a",
  "src/perfDiagnostics.js": "e6e5e3a4fe72ec00df1bd5469147b07d3d6cf8377e9ec691b2908af2cfd494d7",
  "src/pet-awakening.css": "d3945992fca20f6b8f832df4f35a3bd6acffee370d987eabfbe00378db636b14",
  "src/petAwakeningCatalog.js": "eebf2dfd15fa95b54f8c32b85da9b56467ebc4bf39520090e4218224b3ba26bf",
  "src/petAwakeningController.js": "e2c86c5c1074c36ac86dfc99ab901055737b6439edd955f4d089f96e53ced53b",
  "src/petAwakeningCore.js": "b7b4be5b332ff300d73e01b0f90bce83c8b2aec9916f3ab8a1d156f087fbbbae",
  "src/petAwakeningScene.js": "10046736290b074c6fda8106fd51c8c057b03293e7f3a5ef80a3f598af318b6c",
  "src/petAwakeningService.js": "11dd9c96125892d9eb4606aa07caabf4e91544e0a85236560c8af85a79d57f02",
  "src/petAwakeningView.js": "9a34c1850800408124a415f13e92a9a6d5fae35b2c39f9085f3a1741d26083aa",
  "src/petDataSchema.js": "2520849bac99b64337a17ed7836294749a1ff7fe9820391a0f9a71e6f1a7172b",
  "src/petPoolFilter.js": "8aab1c055fbdcd40209864ab4ec8b489cb284c73bcded88fa8a45e7b4eacb6db",
  "src/poolAwakeningController.js": "9db87f801c43d1fe4a69e8b0c91a119ae0e6622f0d477246b606aa56eabf3b51",
  "src/poolContentContract.js": "6a66873b1501392c4e6df51838d6cccbb6a961c7eacff9494ec8773ae746eee5",
  "src/poolDebutService.js": "e820255c52313e465679be1f1ba2a26492dfe0aca7cbfbd8f3627716552e7f7c",
  "src/poolPresentation.js": "a7a4ea67dd7e905dd70faa31527a92a119a47dc7badf3fc51a6b316fde84e5c8",
  "src/poolUnlockCore.js": "2be9a055162feaf7dd521a054e40853c2c3af1106a098708e40d33d2478b2c22",
  "src/poolUnlockService.js": "6e76ffc3c61f002c750435578a7ea5843c91df6f047b2ac2212b50bc150b800a",
  "src/preferencesService.js": "a9083541abf0cc152debd922aaf6a33fbd671dee04b85ce5300a6b2522a58401",
  "src/questIcons.js": "7f9395e0af7db0fda7fa273e793275c94d5b8e3bdd2fb249b726e5f6c2046ad0",
  "src/questService.js": "93e6c875b21a3fb6cf8d0c0ad2ddae2b4307cee870da3b1b92a2a0969977d8a6",
  "src/releaseCatalog.js": "38ac32aedef26d927638ef7413ec78520c0f9d114623a4a61283d488d99cbb4a",
  "src/releaseProfile.js": "b4c1c11d5efcf9496c323b807065593f61eec7241b8d2c139db7876495353900",
  "src/reminder-settings.css": "e90f6e75ac50b3fef946c454c4849f3322cd4e0c06c0b10feb718fef60a878b4",
  "src/reminderController.js": "4ba72d19acca52c417445956521d97ce57b3873b1a61924840fdc47b8a9ad5b5",
  "src/reminderRules.js": "fb8939a256305ef880ecebf063d029dc8a1d37a58e330851b2d96ac001ee57bb",
  "src/reminderService.js": "443462be0699934e7dc731b5a692381acb1f12f1499c237566a16b4ee2c0578b",
  "src/rewardService.js": "a245a6e08e6ead6aa65dc4dbb99e8c767fa81bd210e253955359be1a5442e0ff",
  "src/shareService.js": "33e2b0f4ef31925680287ba7b8e0d04009ef5f149075b6adca84447212b7686c",
  "src/standardUrCarousel.js": "8e2f9f84a14399e61a206d39d1e75ebd1903d025a24866b9b899fe77520deae3",
  "src/styles.css": "417a2ad0ea0bfed9907207376db59c5ab00d6a61ad6721b14589967d6cebc5bf",
  "src/summon-polish.css": "e832165ec56373e338d2af2c80c0cdde109c2d4455094c4e4d8eadb2cd3d1ec0",
  "src/summonRevealService.js": "586d64b87f964cd0b6715091b0fde484afdfd12d15eae4dad720cf9185cd14e8",
  "src/swordwild-shanhe.css": "2879fd56a3d6ccffed6f57383b24fd0308a91c6d55dd0166e9184ee7d07ea044",
  "src/swordwildShanheScene.js": "1f6f9fba2368e8eba318af46f33ff211558b41f7f154b49e190aa9a932b06791",
  "src/taskFilterService.js": "687858edc36119afcb388fc3fd75ebd058d0a93117da42740c8a1f18d4b00471",
  "src/taskMigration.js": "67055f714b759d43e1a333ce7d039619eca3537f5e83ce46ee76a0d4692f25b1",
  "src/taskService.js": "2d95bc05075d7a32f9e45c577cfe54e5650b6c127e53c2fab47410168681c8cd",
  "src/taskStatsService.js": "1e61c0f67426459a73b2c6ec405dbfdef87b86840a519518d9f5432fb4d2cbb5",
  "src/theme-refinements.css": "34221c5c4be673822dcd050e2933e946612d6ad4f02f5077fb5aeb9496b4843b",
  "src/theme-system.css": "8e3560e9d29587c6ff19970f11baa2e51d44f2a92b5e20887de121a4b963560f",
  "src/themedSummonController.js": "d365717cd9238d588405454d6c98f2e1782f37cec8a7b86e76340b48e61d94ee",
  "src/themeRegistry.js": "d4c935dd737d662dffc17bcd4fe6d243aac583095ab5ac2ec43b76126df7bafb",
  "src/themeTokens.css": "7a898e987663c925e1913aafaa318d352048b294553affa068360f2d4ec3a596",
  "src/todayHabitsView.js": "51a16e89416241eda1e105e2fe1d2ce6c6f846a7943f65dd81603432e956879a",
  "src/twilightPresentation.js": "f5868b44baea107e67d6673ce2e6db31c0c6b9da4f2fa9265746e233194cb6d2",
  "src/ui-polish.css": "d320d927f151a01bf2a26d8f60840d42d75b42cf5a5fbeb3354a37f2a74a076a",
  "src/ui.js": "3a8a29e7f9c9cff352a708ae1bc14b8238faecbcb47281ec7cafdb19897508fd",
  "src/uiHelpers.js": "875f08583510e7c246eebeff4b39d6a7273d2643f6a2a2931281672c6c4d7de6",
  "src/updateActivity.js": "a7032e043a14561ad07ab521b649a2bd508aeca6801376066fcab701e3d2b641",
  "src/updateController.js": "e038b05c3fa2e97158cb3a363996e34b10eba3f243dc5284ec540ea0753c93b9",
  "src/updateProtocol.js": "53e770213f0074208c348d7d4a12d68cad79404637eddbe7c2f7c8d3c2cd39c0",
  "src/version.js": "69d98b35f6351f422ac0683064b45fbcbe14185fa835c245fa3af60e369257c7",
  "src/workshopGiftView.js": "6ea791929caaee1e1127cbb23bac061f155bcf24cc6071b78db5d84e5509bb2c",
  "src/workshopService.js": "9df4a6002291dc73eea2c92a1c6db2bbb10c67e2f24ca085757aeb74cddbcdf0"
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
  "assets/expeditions/cloudrest_trail.svg",
  "assets/expeditions/cloudrest_trail.webp",
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
  "data/releases/57ac7816a6dcc7c9db64373f2f98c2ab8f9b817f592ba186c6d41f2edf7f453d/catalog.json",
  "data/titles.json",
  "index.html",
  "manifest.webmanifest",
  "src/achievementService.js",
  "src/adventureHandbookService.js",
  "src/app.js",
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
  "src/collectionMilestoneService.js",
  "src/collectionService.js",
  "src/companionDialogueService.js",
  "src/companionService.js",
  "src/dailyCheckInService.js",
  "src/db.js",
  "src/deferredRenderGate.js",
  "src/devService.js",
  "src/dialogFocus.js",
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
  "src/habitService.js",
  "src/healthCheckService.js",
  "src/honeylight-sugar.css",
  "src/honeylightSugarScene.js",
  "src/iconPresentation.js",
  "src/imagePreloadService.js",
  "src/lionheart.css",
  "src/lionheartScene.js",
  "src/loreService.js",
  "src/mailboxSchema.js",
  "src/mailboxService.js",
  "src/onboardingController.js",
  "src/onboardingLessons.js",
  "src/onboardingService.js",
  "src/perfDiagnostics.js",
  "src/pet-awakening.css",
  "src/petAwakeningCatalog.js",
  "src/petAwakeningController.js",
  "src/petAwakeningCore.js",
  "src/petAwakeningScene.js",
  "src/petAwakeningService.js",
  "src/petAwakeningView.js",
  "src/petDataSchema.js",
  "src/petPoolFilter.js",
  "src/poolAwakeningController.js",
  "src/poolContentContract.js",
  "src/poolDebutService.js",
  "src/poolPresentation.js",
  "src/poolUnlockCore.js",
  "src/poolUnlockService.js",
  "src/preferencesService.js",
  "src/questIcons.js",
  "src/questService.js",
  "src/releaseCatalog.js",
  "src/releaseProfile.js",
  "src/reminder-settings.css",
  "src/reminderController.js",
  "src/reminderRules.js",
  "src/reminderService.js",
  "src/rewardService.js",
  "src/shareService.js",
  "src/standardUrCarousel.js",
  "src/styles.css",
  "src/summon-polish.css",
  "src/summonRevealService.js",
  "src/swordwild-shanhe.css",
  "src/swordwildShanheScene.js",
  "src/taskFilterService.js",
  "src/taskMigration.js",
  "src/taskService.js",
  "src/taskStatsService.js",
  "src/theme-refinements.css",
  "src/theme-system.css",
  "src/themeRegistry.js",
  "src/themeTokens.css",
  "src/themedSummonController.js",
  "src/todayHabitsView.js",
  "src/twilightPresentation.js",
  "src/ui-polish.css",
  "src/ui.js",
  "src/uiHelpers.js",
  "src/updateActivity.js",
  "src/updateController.js",
  "src/updateProtocol.js",
  "src/version.js",
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
        if (PRECACHE_HASHES) {
          const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
          const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
          if (hash !== PRECACHE_HASHES[path]) throw new Error(`Required asset mismatch: ${path}`);
        }
        return [url, response];
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
