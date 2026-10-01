/**
 * QuestNote Service Worker — V3.4.11 verified preview cache recovery
 * 快取 App Shell 與靜態資源，支援離線使用
 * data/global-mailbox.json 使用動態 Network First，不進 App Shell precache
 * 作者本機工具（mailbox publisher／pet series builder／summon preview）原始碼不得加入 App Shell precache
 * 寵物圖片不得加入 App Shell precache
 */

const CACHE_NAME = 'questnote-preview-app-5443bd90acc5b5f6dc14df844b365172b059d7fc1360f48099913ea1fd459c45';
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
  "artifactId": "5443bd90acc5b5f6dc14df844b365172b059d7fc1360f48099913ea1fd459c45",
  "sourceCommit": "0d450279da0eb31aa01439ba7d875ee5ca28a173",
  "scopePath": "/questnote-pwa-preview/",
  "runtimeContentSchema": 1,
  "dbName": "QuestNotePreviewDB",
  "cacheNamespace": "questnote-preview-",
  "contentBundleSha256": "509f8172c0a5f1f29513b10b9bcf46ef5a64668ef9970d1eac35f16f62f41223",
  "contentBundleUrl": "data/releases/509f8172c0a5f1f29513b10b9bcf46ef5a64668ef9970d1eac35f16f62f41223/catalog.json"
};
const PRECACHE_HASHES = {
  "assets/brand/questnote-icon-180.png": "568c5f586481050de3c0263794de557f36acb340346eba7db1a9cdc7b000f9bf",
  "assets/brand/questnote-icon-192.png": "7a2c068ff50729b5b68aba6999ffed491234c11a267ddf26ee6f7a5bc0a1db11",
  "assets/brand/questnote-icon-32.png": "0c09c5fef9a6c10f9e10fab7a923d6e84e06972791106a9960bfe062b83952fe",
  "assets/brand/questnote-icon-512.png": "32c505609ea48e4ffab010e2fc53b184441a8bad39d79a45701b658b31040a06",
  "assets/brand/questnote-icon-maskable-512.png": "54dc03e7eb13c3f4714bc276ea2b9bb1313ef171d27e06f6aa1f378931c6f506",
  "assets/brand/questnote-icon-master-1024.png": "45eabdd090efcaee9c9305bca6d559983433c00db41c287f92f66fbac809adf3",
  "assets/expeditions/astral_rift.webp": "343c7342d7156be0fef42c809e0028811a936e2ba478b2785eaf498845dc4d2d",
  "assets/expeditions/cloudrest_trail.svg": "7c515cbfa33e475c939c53ff680ebe25c8f5f37f8cd2b4e33771b7a3ac8bffa8",
  "assets/expeditions/harvest_fields.webp": "6196b84c367ff547d91741d36a57ed06aa34e15464ddafb071d4940d0014a29c",
  "assets/expeditions/lava_rift.webp": "9c14dd71f7752f8ca652992659ba929a094512ec5dc34b4d3806b90dabac904e",
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
  "data/bond-stories.json": "4b6f40038a9477517adbcc80682ae1f0a753afe2217e487e135634e77c15ba35",
  "data/categories.json": "166e8f4de44f41d6ec27b3a6b1780f9cd155aa599371b443c92537949276ebe1",
  "data/craftables.json": "aae00091888b74f3223919ce2f06f72c10f8ee505cf40b565e0054ae789ac19e",
  "data/dailyWheelRewards.json": "98f1fb5b3dc5e49fb0815cf60842bc53fd34e604baf540b4d0e2946929030f12",
  "data/expeditions.json": "9d14ec309b570be01c65c29dfa8236c1f05b8d5447374e562df5a37537f08530",
  "data/gift-affinities.json": "5c4ae4f64bd97acf70d0ac5d229ddf344c6251f4c54c0dbb5fb2ed63da8afee5",
  "data/materials.json": "ef3aa0d8d7833c5c15504634de7680d43a7404a4012a1377d7d540796125c08c",
  "data/pet-series.json": "b176c710383e78b2e0b6d543bfce5d4244438dfabf2b38806c972f9b555dbc57",
  "data/pets-lore.json": "77dce9e5fbab60b01bf31d5b2e73564c4feeadd8f63380c18bebfec128d6123f",
  "data/pets.json": "a90c6afec9c1d7f95f6dff52020ece50c18d820e5c386a0a067618e9b20b9d00",
  "data/pools.json": "4fd1cdc8674e5592b6b2256603bad59b5bf555650c482237eedb6a86b3867fcc",
  "data/releases/509f8172c0a5f1f29513b10b9bcf46ef5a64668ef9970d1eac35f16f62f41223/catalog.json": "509f8172c0a5f1f29513b10b9bcf46ef5a64668ef9970d1eac35f16f62f41223",
  "data/titles.json": "318675b79872dfabccc4b8beb99f77eb248a40e5e50bbbd4e4dc24886b3a1398",
  "index.html": "4569ac683406f11e6041f07964819ddea78f099868be2b0de342bd64d3456523",
  "manifest.webmanifest": "92eebd112db700add8829cda91380b117bcf4f4d91723ea899055ebde22caad0",
  "src/achievementService.js": "25eba10a95247380c424a59dd539b7c0e55b866992a2eb6404ac74d3fb4b0316",
  "src/adventureHandbookService.js": "d9dc8d34fc08a83c0c2f36682698fd4d96ebd0852c8cb0fde161a5a718d065b9",
  "src/app.js": "e67f958f35fe4b0b527611746c460aedcf600c944d22f9d143905f0ecccc4a70",
  "src/backupSchema.js": "1fb16edc82d05c96776d8ac6d19e6dc195d5705457e88c1b0031c6b1605e3ff8",
  "src/backupService.js": "cdf8b2c1bf2c5ac85f83c8f2805c4dce6aeac4f19bf3aa2877dc42b3c67cf42f",
  "src/bond-journey.css": "c5ada471a6ac232974153239c91b6d4628dc5c4decf32b5f256f031f2346ee49",
  "src/bondJourneyController.js": "cfaabae2b18fbf0917cb074e878a11b557801a449a442e71ef9368124aa81805",
  "src/bondJourneyCore.js": "25cf76d84e0849491bc229af3acbe670acfde12cecafe60a916afd5413276c0e",
  "src/bondJourneyService.js": "cd077be78fd114033d7af2aed1f9ec014e9dbd9df1cbb9d72d674c2f494ca002",
  "src/bondJourneyView.js": "3805105dee2e07ad228477cf6beba617607fa394fccfbeea951279e78339652d",
  "src/bootstrap.js": "424349b05fe4e245c0e7e4dc744bea4e2717851666d12ac49f391b715558e07b",
  "src/bootstrapRecovery.js": "7ed8b4ec63dfd3bb1fb908995c435983816c1cb91146842b9792c8ad840d0d2e",
  "src/campService.js": "fee6e4aeafbde7e3d356214099b50523d31089fb00e573c853810c32062a65b1",
  "src/categoryService.js": "8636cdb8453e0a383b813f99d117ead49911353bd6848de05d7f513c28713e32",
  "src/collectionMilestoneService.js": "2f9fe055d3facfb2ce5f6eee96ee0026eb41dab602f27a0eef104402dbe2db5f",
  "src/collectionService.js": "4babc98a28293244bc833788c641fa20dc0aca396eab6aba0f5ba797f35d3da6",
  "src/companionDialogueService.js": "8fe79ef7d7d94e3a654b8f9ee43178cc4fac01bfbf1cc67b53b173be3f17c955",
  "src/companionService.js": "3974b56613aea67e80f7659caa9dbca0d9397f298948f1f98c9e60b8e446d6aa",
  "src/dailyCheckInService.js": "d994210565a779da2265f8a32334dc233a06b4dee037672ef433eb5fa123b62b",
  "src/db.js": "012951056447133e1735f9c93ac2361d61151c91dbcedff20016ffa8e22300fd",
  "src/deferredRenderGate.js": "cbbaf2e401be35eab6d673a935c13fef615286a554937dc497b02c4aa6aca6e5",
  "src/devService.js": "af56b92e6fcf886786f4a41d777dc355c35c0d0bd4b39fd72fc11217c4238dd4",
  "src/dialogFocus.js": "24eb36d909579732f8b9776c4f2e2a3fec8e112d8e96194257b6b16bee49eecf",
  "src/expeditionGameplay.js": "35fd8a110ccf27f09c30f8128b49b00bee30b32516ded08fcbd4320d1e6353e4",
  "src/expeditionService.js": "a0393db1951029c6496216e3af4c6b771ab35c590ddff74adc44c5c68136581d",
  "src/expeditionStatusService.js": "310284957e4ce332bfb51f9b7eeac7d620495800985a235fef9e2291380cf43d",
  "src/explorationService.js": "49224d065381eafca0b6d27d361da0bce07e33cfadfa3756dd962e9c1a7c6937",
  "src/feedbackConfig.js": "77e9eda8efe76ad2ea3d1d216d10be01bb219c954c6c619e925d8e2aeafe49f7",
  "src/feedbackController.js": "9ff600987abd7476b7e6e1bfecb9610ba93588dc0b0930b3c3378c8c78b83e76",
  "src/feedbackService.js": "f96898f3d97d6dc86157f65aae8e8f2b763f222b04bf778aab386276d8bb9310",
  "src/filterGestureController.js": "548300cf1d63d705715fc00668b48b35b5389f351e21ffc3a8e417a350774ad7",
  "src/font-size-settings.css": "47476e661b6f993b8586f37fe5303add68c679793effb9ecaafc2c5b1adde74f",
  "src/gachaService.js": "d631816bfcb980ecbe502cbecf867e0adf65871d00d6ef4e70adce22df9c9bf9",
  "src/gachaTransactionCore.js": "ac2b5db58e2cdec942bb28e0e7b8dae446282fd45518bdf6666fafdc6d579dde",
  "src/glacierArrivalScene.js": "bb3d646a9faaece23f41d29f6248b682fb67e3851e702ac3667f006c02d8b2bb",
  "src/habitService.js": "64d488828c26e49b47ec06d17ad853b473ea21aee2307b0cd5963fb225cc78de",
  "src/healthCheckService.js": "83e35ca90fb51b2029a82adac11cb96a4fec40063ce840081a05fb24092e365f",
  "src/honeylight-sugar.css": "5255d8f40152e53c13d9549dda2fe7e26337fb9ddeb98f6cf2e957c34c83be22",
  "src/honeylightSugarScene.js": "c67111490307d36ee858219603f0012ecd633e32f07775983325210466b59562",
  "src/iconPresentation.js": "e093f1b2bfc0c300741644d881c6731f7b758be0e5917cf7cc1a036bd06e8013",
  "src/imagePreloadService.js": "73f6488373daac9b4134c4c7a9549da98f4974d3a4987b4698dc4a56680ad333",
  "src/loreService.js": "2beab9e2c2ab3418b16e638e247d1976c916b537e6a7a21d754751c54336541c",
  "src/mailboxSchema.js": "070e2c731ac75a6bdbecfc24afad986d0357e440d1449c374d898d7e0b0ccd15",
  "src/mailboxService.js": "9e2b08feedc9dc73beb9d18bcff62fd722af276c57ab4f79f9bc8d20eccfa0d0",
  "src/onboardingController.js": "3592185e4c6fba023c65e8d8903ca2e169c092b107b8674e242d688575df872e",
  "src/onboardingLessons.js": "a9438d97708b85dccc2b6faff038a41d2f9051929d8341d28321ff90032bbd31",
  "src/onboardingService.js": "4289008c57efc95843d141a33cb2333c0d9af8c1188a3ba4157e2ab2dfd49a6a",
  "src/perfDiagnostics.js": "e6e5e3a4fe72ec00df1bd5469147b07d3d6cf8377e9ec691b2908af2cfd494d7",
  "src/petDataSchema.js": "157323ee04b497c281cb5a5371b298e0e9af40761f3d35a6c303b868698db73b",
  "src/petPoolFilter.js": "8aab1c055fbdcd40209864ab4ec8b489cb284c73bcded88fa8a45e7b4eacb6db",
  "src/poolAwakeningController.js": "9db87f801c43d1fe4a69e8b0c91a119ae0e6622f0d477246b606aa56eabf3b51",
  "src/poolContentContract.js": "2f0ac22d0406c4a6d5f5496ff72fb56ec20bf0b6030e743ab6f98fec03ed20bc",
  "src/poolDebutService.js": "e820255c52313e465679be1f1ba2a26492dfe0aca7cbfbd8f3627716552e7f7c",
  "src/poolPresentation.js": "8ceeb36eb66f87277fd9a9d87d07ccd50d20c154345f42fd0443ea684047418f",
  "src/poolUnlockCore.js": "2be9a055162feaf7dd521a054e40853c2c3af1106a098708e40d33d2478b2c22",
  "src/poolUnlockService.js": "6e76ffc3c61f002c750435578a7ea5843c91df6f047b2ac2212b50bc150b800a",
  "src/preferencesService.js": "a9083541abf0cc152debd922aaf6a33fbd671dee04b85ce5300a6b2522a58401",
  "src/questIcons.js": "7f9395e0af7db0fda7fa273e793275c94d5b8e3bdd2fb249b726e5f6c2046ad0",
  "src/questService.js": "93e6c875b21a3fb6cf8d0c0ad2ddae2b4307cee870da3b1b92a2a0969977d8a6",
  "src/releaseCatalog.js": "38ac32aedef26d927638ef7413ec78520c0f9d114623a4a61283d488d99cbb4a",
  "src/releaseProfile.js": "9227e5d8dddd93782ea4f1c74d2457d4fb846ad4f5f1cfe825b7d7fc8bfefd1d",
  "src/reminder-settings.css": "e90f6e75ac50b3fef946c454c4849f3322cd4e0c06c0b10feb718fef60a878b4",
  "src/reminderController.js": "4ba72d19acca52c417445956521d97ce57b3873b1a61924840fdc47b8a9ad5b5",
  "src/reminderRules.js": "fb8939a256305ef880ecebf063d029dc8a1d37a58e330851b2d96ac001ee57bb",
  "src/reminderService.js": "443462be0699934e7dc731b5a692381acb1f12f1499c237566a16b4ee2c0578b",
  "src/rewardService.js": "a245a6e08e6ead6aa65dc4dbb99e8c767fa81bd210e253955359be1a5442e0ff",
  "src/shareService.js": "33e2b0f4ef31925680287ba7b8e0d04009ef5f149075b6adca84447212b7686c",
  "src/styles.css": "417a2ad0ea0bfed9907207376db59c5ab00d6a61ad6721b14589967d6cebc5bf",
  "src/summon-polish.css": "0d3cbae026034e11034be8ecabc6ff9613a461fbaee616376a26f90f4b924bda",
  "src/summonRevealService.js": "cfdbc7d48699373b7a1644dc1fbe9bd01f7134a83c62e013620d0aa91ee705b0",
  "src/swordwild-shanhe.css": "366ac697dd358a9d277cad9a49c97e628394255d2c78305dc66503b56af24852",
  "src/swordwildShanheScene.js": "3c723ec4be07478a5125de310b677380223f2c55e391d50b29cb936fde07fada",
  "src/taskFilterService.js": "687858edc36119afcb388fc3fd75ebd058d0a93117da42740c8a1f18d4b00471",
  "src/taskMigration.js": "67055f714b759d43e1a333ce7d039619eca3537f5e83ce46ee76a0d4692f25b1",
  "src/taskService.js": "e12190eb4cf777b79e49d327547544be53af707e1237928b8d7c93c040ceca84",
  "src/taskStatsService.js": "1e61c0f67426459a73b2c6ec405dbfdef87b86840a519518d9f5432fb4d2cbb5",
  "src/theme-refinements.css": "34221c5c4be673822dcd050e2933e946612d6ad4f02f5077fb5aeb9496b4843b",
  "src/theme-system.css": "8e3560e9d29587c6ff19970f11baa2e51d44f2a92b5e20887de121a4b963560f",
  "src/themedSummonController.js": "bdec20f49d44b1e061083b3ed3bf8e5121ed24bb39333a85ed6955d470a7d809",
  "src/themeRegistry.js": "d4c935dd737d662dffc17bcd4fe6d243aac583095ab5ac2ec43b76126df7bafb",
  "src/themeTokens.css": "7a898e987663c925e1913aafaa318d352048b294553affa068360f2d4ec3a596",
  "src/twilightPresentation.js": "f5868b44baea107e67d6673ce2e6db31c0c6b9da4f2fa9265746e233194cb6d2",
  "src/ui-polish.css": "ca66a2c6bb7ecd4e1062c34889533bb2ebab5264e218d830fbd1a9982c1a26da",
  "src/ui.js": "6e8fad84427fb753451c1e9389656df45d2d44095a025654a14ee926aaf77e46",
  "src/uiHelpers.js": "875f08583510e7c246eebeff4b39d6a7273d2643f6a2a2931281672c6c4d7de6",
  "src/updateActivity.js": "a7032e043a14561ad07ab521b649a2bd508aeca6801376066fcab701e3d2b641",
  "src/updateController.js": "e038b05c3fa2e97158cb3a363996e34b10eba3f243dc5284ec540ea0753c93b9",
  "src/updateProtocol.js": "53e770213f0074208c348d7d4a12d68cad79404637eddbe7c2f7c8d3c2cd39c0",
  "src/version.js": "090c986315ab6bda41b6ebeaeb7fda6c09a122ac1c664aa65123daec385f0214",
  "src/workshopGiftView.js": "6ea791929caaee1e1127cbb23bac061f155bcf24cc6071b78db5d84e5509bb2c",
  "src/workshopService.js": "5c1940a3116e93e8e9376a102621f02ff3a58c9d575491e875420dd4890b9480"
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
  "assets/expeditions/harvest_fields.webp",
  "assets/expeditions/lava_rift.webp",
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
  "data/pet-series.json",
  "data/pets-lore.json",
  "data/pets.json",
  "data/pools.json",
  "data/releases/509f8172c0a5f1f29513b10b9bcf46ef5a64668ef9970d1eac35f16f62f41223/catalog.json",
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
  "src/loreService.js",
  "src/mailboxSchema.js",
  "src/mailboxService.js",
  "src/onboardingController.js",
  "src/onboardingLessons.js",
  "src/onboardingService.js",
  "src/perfDiagnostics.js",
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

