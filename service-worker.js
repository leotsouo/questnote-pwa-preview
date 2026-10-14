/**
 * QuestNote Service Worker — V3.10.0
 * 快取 App Shell 與靜態資源，支援離線使用
 * data/global-mailbox.json 使用動態 Network First，不進 App Shell precache
 * 作者本機工具（mailbox publisher／pet series builder／summon preview）原始碼不得加入 App Shell precache
 * 寵物圖片不得加入 App Shell precache
 */

const CACHE_NAME = 'questnote-preview-app-7fd04c01509c9ec89ddf7084b8cade9adedc0a3baf74606324e69e690a9667ff';
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
  "artifactId": "7fd04c01509c9ec89ddf7084b8cade9adedc0a3baf74606324e69e690a9667ff",
  "sourceCommit": "5d119cadfefa799067326e828342f32bd0e60e65",
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
  "assets/expeditions/cloudrest_trail.svg": "e23e3af8c958f5b17a4bf37b639e0875494359601721e0e23bd674ff765868c9",
  "assets/expeditions/cloudrest_trail.webp": "cf75419ec519bb473ac49f32a6c9af68165550117585ab32649caae2ad9108fd",
  "assets/expeditions/darkcrown_border.webp": "689d9423da5acb1a983147ff18dfb5103953fec35fa52ec0908abf1417149d34",
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
  "data/craftables.json": "95b82ff59299bd33178a64ae801d3725d6ad0a9812db9f2e0743633bfce56a4f",
  "data/dailyWheelRewards.json": "98f1fb5b3dc5e49fb0815cf60842bc53fd34e604baf540b4d0e2946929030f12",
  "data/expeditions.json": "34620b7aaf50f26d91d560050c76acc71dab148510e6275e1dfe6c73f272aca2",
  "data/gift-affinities.json": "9de6c95bd696bf98955c0fd04ffcf0ad3a23dd9667a9b388ae8329000eab324b",
  "data/materials.json": "e301faa6c4f7d8c5ca4bc771d189917cab56f07f3457883bad84849489969455",
  "data/pet-awakening.json": "8763088091b95b9eff801668889add2cdff1d6529137c24d11ede8e7260357c5",
  "data/pet-series.json": "b176c710383e78b2e0b6d543bfce5d4244438dfabf2b38806c972f9b555dbc57",
  "data/pets-lore.json": "77dce9e5fbab60b01bf31d5b2e73564c4feeadd8f63380c18bebfec128d6123f",
  "data/pets.json": "a90c6afec9c1d7f95f6dff52020ece50c18d820e5c386a0a067618e9b20b9d00",
  "data/pools.json": "4fd1cdc8674e5592b6b2256603bad59b5bf555650c482237eedb6a86b3867fcc",
  "data/releases/53f3cf3aea133c9186cbaf0396dfd54241d5fb0bb4debbf57601cd4d2c944046/catalog.json": "53f3cf3aea133c9186cbaf0396dfd54241d5fb0bb4debbf57601cd4d2c944046",
  "data/titles.json": "318675b79872dfabccc4b8beb99f77eb248a40e5e50bbbd4e4dc24886b3a1398",
  "index.html": "bf75eb3f83f13a475d6da048076a2f98f05707168664673fde7baff914c468aa",
  "manifest.webmanifest": "92eebd112db700add8829cda91380b117bcf4f4d91723ea899055ebde22caad0",
  "src/achievementService.js": "98d9cc071a70f849b2e856563e1e2ad0663164cc2b9747c18f259f1dff497620",
  "src/adventureHandbookService.js": "94d08c97deeb211f9f2aa5c50d482af46a13d957c8ad0e6da703172d43ced6d7",
  "src/app.js": "19e51d4a4a55018ee5366ecd9a76ac71a0227c6ffa9bee0948191d95f14c86dd",
  "src/aurora-fairy-feast.css": "ab9065ef79cd852cac4df844bc3eb61c4923a89bed4f259dd88d40c3c1ab24cd",
  "src/auroraFairyScene.js": "923dd1fd463546907f90ac6ad11b2609d01251fce91efbcad52bd4e4390403d4",
  "src/backupSchema.js": "3fc63f7f15df349cfe941c855ae9b08c26301635fc2eae7315659e23863dabd9",
  "src/backupService.js": "f178428819ec117dc10491e578ecb02dd7f9736e1c0b163b736db1392c9e2dee",
  "src/bond-journey.css": "c5ada471a6ac232974153239c91b6d4628dc5c4decf32b5f256f031f2346ee49",
  "src/bondJourneyController.js": "cfaabae2b18fbf0917cb074e878a11b557801a449a442e71ef9368124aa81805",
  "src/bondJourneyCore.js": "e66a1621b56f504e1d16444b518c37da4fc003e9b6a68439082b9a73aeffd762",
  "src/bondJourneyService.js": "f8de8af6b40b44e0cb4599b70d8965fd9aaef7628c4a0410e690b0868a27cc1a",
  "src/bondJourneyView.js": "3805105dee2e07ad228477cf6beba617607fa394fccfbeea951279e78339652d",
  "src/bondStoryCatalog.js": "8f243911238e6f30377c922c787cab9b26b521dbe2fe59a9c145440c57b0a514",
  "src/bootstrap.js": "424349b05fe4e245c0e7e4dc744bea4e2717851666d12ac49f391b715558e07b",
  "src/bootstrapRecovery.js": "7ed8b4ec63dfd3bb1fb908995c435983816c1cb91146842b9792c8ad840d0d2e",
  "src/campService.js": "fee6e4aeafbde7e3d356214099b50523d31089fb00e573c853810c32062a65b1",
  "src/categoryService.js": "8636cdb8453e0a383b813f99d117ead49911353bd6848de05d7f513c28713e32",
  "src/chaos-demon-court.css": "f81ec8e7b63e1d3a06f3a435e6146709926994559f93dd0495ec004572572087",
  "src/chaosDemonCourtScene.js": "ccbd258a3013b16dd96eab69111ae41bf0122e71fe8291895a9057bf52fa42c3",
  "src/collectionMilestoneService.js": "ef3466a6a3a5e8844b710ea425eec1de972d98f20099458d8c1996190c369b21",
  "src/collectionService.js": "45609153f022cfdcb2d0997c5785a214178a44be471c5ad61789626039f62869",
  "src/companionDialogueService.js": "ca84154fbb28fadbaa176f46c02079b8be2c9863f4567d5c2cc6c29347998876",
  "src/companionService.js": "3974b56613aea67e80f7659caa9dbca0d9397f298948f1f98c9e60b8e446d6aa",
  "src/daily-race.css": "0f172aad1b68ff1a6bf2f1a7a28ade24de2fe5e05814d5232a919d349adc1f5a",
  "src/dailyCheckInService.js": "8edd56d8918232f5c1d19ce46e3a39686d761b73a0e28fe0a6bbc170661575ad",
  "src/dailyEncounterCore.js": "1053f0670c5037cf1e84535191ae53b38b58b220a624b5c22d84482d6b226a03",
  "src/dailyRaceController.js": "89bdd08a6604d605e57bce2340234285b571babd7d88459a191dacdabba8b16f",
  "src/dailyRaceCore.js": "03e5047cb773ecf3882ea84fca4e758cee27c36d56cc2448d93c4a6659eaf53c",
  "src/dailyRaceScene.js": "b2ae89af2974ad06786675c0de2301402a3cac29db1aa5a439b4378d12079abe",
  "src/dailyRaceService.js": "dbeb6eecef691df99d934b9ca6b48ea8418a36de1759b3e24c7ee6491654cb31",
  "src/db.js": "b7c29cc5e9bb6d474c532253344463876bb8764b8fcc48be354b4c304cec3795",
  "src/deferredRenderGate.js": "cbbaf2e401be35eab6d673a935c13fef615286a554937dc497b02c4aa6aca6e5",
  "src/demonFinalTaskCore.js": "679bfb63ddd422db89d70895fed008c61c5bb87ba28414b2067b68fa8302177a",
  "src/devService.js": "af56b92e6fcf886786f4a41d777dc355c35c0d0bd4b39fd72fc11217c4238dd4",
  "src/dialogFocus.js": "4f57540c2d50ec2ff6a82c7996940466e21b2a212f349a963897bfa76a094a67",
  "src/encounter-ceremony.css": "ae74aac4b2d91c35d0728cf02c049e1d0cfc09bc6c316d0d65286a3e30ed6c5f",
  "src/encounter-invitation.css": "d16c5f09645843e2e18733e0ed141a02c44da056197dfcaa9622d7253884dd4a",
  "src/encounter-view.css": "5c7c87f3d45c67c59311a0f56ebad770fc84baca744d18b10291b2fb2360eb8f",
  "src/encounterCeremony.js": "3b4f57608663561e35e4c84be191237faad5dda659e517fd7cd37e48026b879d",
  "src/encounterEconomyCore.js": "c1833e5e441b01ff1d65c26bc2cc33bfbae9d54ae7e7996bdc190a45c34b3012",
  "src/encounterEconomyService.js": "7f7ed8f10ab135f512e1a0089cfc92173177602999ee29319dc867775d1361e1",
  "src/encounterScenery.js": "f94fe3d764ec0c920674f6991fe4ed271741ec1e960170a2f9e7c12baa9adef9",
  "src/encounterView.js": "71ac539029411e337a91afcaf5d7c20941c6541f3e5064f3f6a01f8c2cc736d7",
  "src/encounterViewModel.js": "8897d6d065c40ac300e7fa0adda9bbe46d86839592a695bd291efb8eec00ad7e",
  "src/expeditionGameplay.js": "27663ced39bf8c562a021f47c04e6170c5e40c06d051520cfe0d73a93e3d162a",
  "src/expeditionService.js": "5dabcb16917d0b37e8bf6e9fac0b7f6fc99845e8ad766dd959104fe5cfe0ac0e",
  "src/expeditionStatusService.js": "99e665eea61bc0de3f9dcc6a1f1cfe01c17914f27b4bf3ce6347ef7d7302e3e5",
  "src/explorationService.js": "c83b5a3d12a35cf3f99009bce9983981d6b46c1ed9f8ff50463b2eff3c9c30b2",
  "src/feedbackConfig.js": "77e9eda8efe76ad2ea3d1d216d10be01bb219c954c6c619e925d8e2aeafe49f7",
  "src/feedbackController.js": "9ff600987abd7476b7e6e1bfecb9610ba93588dc0b0930b3c3378c8c78b83e76",
  "src/feedbackService.js": "f96898f3d97d6dc86157f65aae8e8f2b763f222b04bf778aab386276d8bb9310",
  "src/filterGestureController.js": "548300cf1d63d705715fc00668b48b35b5389f351e21ffc3a8e417a350774ad7",
  "src/font-size-settings.css": "47476e661b6f993b8586f37fe5303add68c679793effb9ecaafc2c5b1adde74f",
  "src/gachaService.js": "5d8921681d16d357bae864bacbdb2e8d453f2cac26e2445a2a4974d245858fad",
  "src/gachaTransactionCore.js": "cc06178e839ff9138aa9cc5e5d68cac47d091c5607d2e52d5f36257365ec7eed",
  "src/glacierArrivalScene.js": "328167de5397d1ebfbfe8fa5ec7338a4b8b285666fa57d598dbcd14d5121f0eb",
  "src/guided-onboarding.css": "ebaaece25bd8993b2e61741b1fbd725b6a7739d25fa04a7aeb6ae2513a7a0058",
  "src/guidedEducation.js": "9a13d3105bc048276a585255494d1fbaef190699fed798a599a68b110cc9d801",
  "src/guidedOnboardingController.js": "c3968533d4674ce697097d669221a38f413da966291fb6ec8eaccac1236883c9",
  "src/guidedOnboardingCore.js": "8aaebb48cde07f48bd2c103ee4b2fd029f9269dce29ff407d0edeb200f0f2a1b",
  "src/guidedOnboardingService.js": "fea7fd048f7ba797b837e59f25dc072e38b16c7445b24c28b88e9fcd23350d31",
  "src/guidedPageTour.js": "37256473cf2931ec2f702b7fabccfd16012cb6327cb15ebb444371ca8ac9b4bf",
  "src/habitService.js": "ccfa3c54ce88d8333fe50e0f4de5926e27d1f8122c919b1bed2b62f160d5e240",
  "src/healthCheckService.js": "c047cd4f5843d1aa20306cd04e6f29adef480fa620349964fb738bc32a7a41a2",
  "src/honeylight-sugar.css": "150412ddfed5fd85d205e0d1be742e311d335b389fca4eb71bc98e93187157af",
  "src/honeylightSugarScene.js": "3e3405b97b345a4bab9207b985f2946524eb16269f61a0a3d1c72b541244119e",
  "src/iconPresentation.js": "e093f1b2bfc0c300741644d881c6731f7b758be0e5917cf7cc1a036bd06e8013",
  "src/imagePreloadService.js": "73f6488373daac9b4134c4c7a9549da98f4974d3a4987b4698dc4a56680ad333",
  "src/invitationPresentation.js": "1f39c530e145750dcc90eacfd8dda790bbf621784585ca62882eb36b410c8826",
  "src/lionheart.css": "4222a8f8646d0c2abf36091ad7bb28fb8e0e70bf4b0513e3f5c9bfbecda5a46a",
  "src/lionheartScene.js": "db49c0b914ebce121100cbfb2468ca899bdf5f4576230ff40fca60fd7b26bac1",
  "src/localArtPreview.js": "a4456caac3d209cb86c38b86ec187949b94602fd3fde966d3a78c0a30aa47b7e",
  "src/loreService.js": "2beab9e2c2ab3418b16e638e247d1976c916b537e6a7a21d754751c54336541c",
  "src/mailboxSchema.js": "8419f90cdf00a7480de008730c75778469179793211cd784fb9d6f5a20b48ed8",
  "src/mailboxService.js": "43e71f8e06ad0a81ccfaea410f334af2663d9363275b42b006ce1f6194256158",
  "src/onboardingController.js": "4d6210b0d4d82cae78cb4d67eed9e1cb1d422f737b867d6f730ef4a22294443a",
  "src/onboardingLessons.js": "41ea3bf7636ae9a766438ab1409264b97e3458ff230b63dbd61287fb121a6f11",
  "src/onboardingService.js": "a3726b9cdcccdc9247288f89a4716ee16a0d9303141554a8c2ae985d1c87f981",
  "src/perfDiagnostics.js": "e6e5e3a4fe72ec00df1bd5469147b07d3d6cf8377e9ec691b2908af2cfd494d7",
  "src/pet-awakening.css": "cedd4a35bc82055d63d1291bc82ba86a1ff344dbb3d9b37d9fd9171c408c21f9",
  "src/petAwakeningCatalog.js": "f8f96727d4d7858b4ba7f06c6c4e85bc380d77101e1e619cf390594680b3248c",
  "src/petAwakeningController.js": "d9bf0458a9cf4ed26e128ea7dadc626bed240c1c41947ddb76037398db9cdc33",
  "src/petAwakeningCore.js": "d95680994395d6c8ccddd889f8fd623a24d9b3c6271b76024061b8ee19c768e3",
  "src/petAwakeningProfiles.js": "cab3c3852844e09469b63a2302f73daa510c32b6ac112b1d827a44a0caebff4c",
  "src/petAwakeningScene.js": "9dcd92cb7226ea5c9da85c90c8a6882f28c36671aff0edb1cd139450ed916f60",
  "src/petAwakeningService.js": "2213c29dbb46d83e1aaca651ccd2d9e3f1f55af718998f9e2790db64c2e7c585",
  "src/petAwakeningView.js": "423b3d92a4ee22e01dc0903d1f644821e19646c600dcdcaa84a120c6c37f8ecb",
  "src/petDataSchema.js": "2520849bac99b64337a17ed7836294749a1ff7fe9820391a0f9a71e6f1a7172b",
  "src/petPoolFilter.js": "8aab1c055fbdcd40209864ab4ec8b489cb284c73bcded88fa8a45e7b4eacb6db",
  "src/poolAwakeningController.js": "9db87f801c43d1fe4a69e8b0c91a119ae0e6622f0d477246b606aa56eabf3b51",
  "src/poolAwakeningPreview.js": "dfaec89d4940f625035621c30b6b98d7fe810fca2b377a1ddb2be4ed6cfde2c2",
  "src/poolContentContract.js": "a4628d92d441bd091a8ef2c7d0e464c4a5fb9c189670b352e1f35b5310b76e6b",
  "src/poolDebutService.js": "e820255c52313e465679be1f1ba2a26492dfe0aca7cbfbd8f3627716552e7f7c",
  "src/poolDirectory.js": "16d091a224cbb7e655a4d035cd017644d3d25040cbfc573d7f12e228ea2d3dcd",
  "src/poolPresentation.js": "1b7ea97b7009174328e43af8050d4f0d67da9e535fd222e8ade2c544a05661bf",
  "src/poolRecommendation.js": "7ce101414e96ffa496050e61f26fb8d24b25828c102d96e43ad72ba008837c3b",
  "src/poolUnlockCore.js": "870277d0f58c7d504883d7223078a0e1bc492e7008794e2f74c6afd6d4f67463",
  "src/poolUnlockService.js": "613f0436ebf7a04743e5de02a1eaeae95b2f9d29afe8fcb79cb330c9398ded76",
  "src/preferencesService.js": "2acef82ae9023b7455220aea530397b066ad5cee820ce60edb1f3ed5d9af0011",
  "src/questIcons.js": "7f9395e0af7db0fda7fa273e793275c94d5b8e3bdd2fb249b726e5f6c2046ad0",
  "src/questService.js": "ae9532ad78abb8af981d3d76adb9f06f132e81e1fed945bd77a608a7dd2bfa3b",
  "src/releaseCatalog.js": "38ac32aedef26d927638ef7413ec78520c0f9d114623a4a61283d488d99cbb4a",
  "src/releaseProfile.js": "1ab30f5eebfdb569c30f577c8fd91b0b55d4a12bb7ab12bb1f78602fe24f1c49",
  "src/reminder-settings.css": "e90f6e75ac50b3fef946c454c4849f3322cd4e0c06c0b10feb718fef60a878b4",
  "src/reminderController.js": "4ba72d19acca52c417445956521d97ce57b3873b1a61924840fdc47b8a9ad5b5",
  "src/reminderRules.js": "f9cfd9f99703dfd3e91f12f4382716875964b09785bf67418dfdc607c5cb1c5d",
  "src/reminderService.js": "443462be0699934e7dc731b5a692381acb1f12f1499c237566a16b4ee2c0578b",
  "src/rewardClaimService.js": "e801ad5ca9646aabdd530560a5f184a2ea99befecb53f4d59fbaeb15e594374b",
  "src/rewardService.js": "c6169eb1d6cb15fd8ddfb6b54ad0a295599ac8a3a38e38903214a42c43bd2006",
  "src/seniorMode.css": "53fad73278f732b2377937103aff04c4ef0da242b15ccba5dae3f2aa5ea0c890",
  "src/seniorModeController.js": "834388ec988a9eb436add0d0563be48f04657f7a475efa49357d8a8b1afdc17b",
  "src/shareService.js": "33e2b0f4ef31925680287ba7b8e0d04009ef5f149075b6adca84447212b7686c",
  "src/standardUrCarousel.js": "8e2f9f84a14399e61a206d39d1e75ebd1903d025a24866b9b899fe77520deae3",
  "src/styleParts.js": "c836074d8dc03d4310a8e04702d741ae9c72e8e548971e65d5ba299ef3f05f03",
  "src/styles/01-foundation.css": "e68d62de49f5ab46cf4203638e15088f05368b432138b37fbb516c46a2a4b4a8",
  "src/styles/02-core-views.css": "ea69d44c62fb24f9cb4956f270254e6cf62aed650093b23490aacde448106963",
  "src/styles/03-tasks-habits-workshop.css": "3170e5030bdabd73f60439619313ae163c9afa52e57a18b330d540e038004b26",
  "src/styles/04-toasts-forms-themes.css": "46aea55e16a0a02629ab54ad09628065d0f53143cb2b655d41f08bb1c769852d",
  "src/styles/05-daily-blessing-wheel.css": "e75956b664c7d25200f7b3863e48ba1a1ad837f46b8562a330bc9259f3bedde2",
  "src/styles/06-rates-summon-reveal.css": "48243179fa0d3c8470226eca3831cab2b725f06e7c96ff762c1988a75fa077cf",
  "src/styles/07-quests.css": "3ea1ccb3c0c46134b3b30bb251f09f32add18d37f36b745d6fb359fd9e40ff74",
  "src/styles/08-bond.css": "aab971077a5c27f341df23c1687962b77446795e83b47acdb985f281f3bc886a",
  "src/styles/09-exploration-expedition.css": "034222e0d41bdf2106cfeb5c225f059cc6bb1e0e6a311a6465e1bbaf90e32ae5",
  "src/styles/10-typography-collection.css": "4dcd85a66f8804e7ff7ee660cc88a6091aa72edbe891e2e591f3919b63396a20",
  "src/styles/11-mailbox-handbook.css": "3aba2abade83c6547dcd2ba2477e88d6e03cbe3baef2b4e1f863c25ad2253247",
  "src/styles/12-themed-pools.css": "05e78263b8f2f20c151bf298c28bfba3ce9635f2fe73cd0ae5b12634bc45b62c",
  "src/styles/13-feedback-workshop-camp.css": "dc6e3b76bc565f1bfb61552a2d46a2c8264160cbce95a3a5a63fe8a33943665e",
  "src/summon-polish.css": "247f7bcd99b0fc1473af045c82301c0eebbfd11aaf54203bcabab989e5d9722a",
  "src/summonRevealService.js": "9336c84e34de82110ad54c10b3b69ec29a945e5b1e4a2f70ec1d06d63fcbd136",
  "src/summonTiming.js": "076431aef8d6fe9bb4c3ad5bd82ca3c985be10c4b02ed50dae086f6f619c7ae5",
  "src/swordwild-shanhe.css": "fd251695bcca1fe0e60dbeae142d3dcb0f41654b9ba3d5db019758c226f94143",
  "src/swordwildShanheScene.js": "0f61a0bcd593ccaa5fa4560102fc109324e88b78b52b55d70036fd2a317807aa",
  "src/taskFilterService.js": "bcf50aed91425cb55edb876cabd4e69bc38f0884830eb6a08a87fd758401bca9",
  "src/taskMigration.js": "3c2d8abdd71613ab5653c234cac979015b49fe2f96e1ab18b8b01962ecd80acd",
  "src/taskService.js": "53b7bcaa4852a2c4b106f6791fb3756022895676c7a7c0df7d3f3625d3ecd731",
  "src/taskStatsService.js": "1e61c0f67426459a73b2c6ec405dbfdef87b86840a519518d9f5432fb4d2cbb5",
  "src/taskVoiceInput.js": "9b38b21c7ae39dd927d59bc660a83207576b9c3b0802c4a4f494dfc954ef77b3",
  "src/taskWizard.js": "2e34043e20dc9808b0e05c09daf714124c8e3e867216ea9d9188530d9ac9fe1c",
  "src/theme-refinements.css": "370638cec0f341c32b1646084a1ad9917240d494cb4b2b197040aa753010fe95",
  "src/theme-system.css": "4276e7af30e0cb179e7bde03900818020120a1cd6d0c8e63e87aaab3f3b4a670",
  "src/themedSummonController.js": "33b7c08c03cb9b076111071cd1409c569ed50bcb25e4ea23123fc6eb31cee784",
  "src/themeRegistry.js": "d4c935dd737d662dffc17bcd4fe6d243aac583095ab5ac2ec43b76126df7bafb",
  "src/themeTokens.css": "7a898e987663c925e1913aafaa318d352048b294553affa068360f2d4ec3a596",
  "src/todayHabitsView.js": "51a16e89416241eda1e105e2fe1d2ce6c6f846a7943f65dd81603432e956879a",
  "src/twilightPresentation.js": "905c328be48088db41ea7be5804ad5da84de5498f3b5ad9d3d375c2df12219ab",
  "src/ui-polish.css": "84d6af7a8206e91be084e1e9b868d51b1bbb4da50550936ccb4c24724e350f5e",
  "src/ui.js": "8127582ddb3d218ff2cfbc9eeb7268d36718fd999586366da8e5ef788fa2c5e7",
  "src/ui/dailyWheelView.js": "2084cbe2a782fa724d321e48787d83bc7cf47fb5626d715f954ac5e38528e7f6",
  "src/uiHelpers.js": "875f08583510e7c246eebeff4b39d6a7273d2643f6a2a2931281672c6c4d7de6",
  "src/uiSourceParts.js": "4894aee90ddd225aeb7f16b53b54ec872bedb1e7ce1aea4d710ae50a1c8c330c",
  "src/updateActivity.js": "a7032e043a14561ad07ab521b649a2bd508aeca6801376066fcab701e3d2b641",
  "src/updateController.js": "e038b05c3fa2e97158cb3a363996e34b10eba3f243dc5284ec540ea0753c93b9",
  "src/updateProtocol.js": "53e770213f0074208c348d7d4a12d68cad79404637eddbe7c2f7c8d3c2cd39c0",
  "src/version.js": "6eb111b6061c0d5c12643a9edebabcc5d1de836e98e8c83ddbdde056d447e908",
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
  "src/ui/dailyWheelView.js",
  "src/uiHelpers.js",
  "src/uiSourceParts.js",
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
