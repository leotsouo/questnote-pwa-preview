/**
 * Ordered parts of the base stylesheet. index.html links them in this order,
 * service-worker.js precaches them and src/styles.css imports them for dev tools.
 * The cascade depends on the order; devtools/style-parts.test.mjs keeps all four in sync.
 */
export const APP_STYLE_PARTS = Object.freeze([
  'src/styles/01-foundation.css',
  'src/styles/02-core-views.css',
  'src/styles/03-tasks-habits-workshop.css',
  'src/styles/04-toasts-forms-themes.css',
  'src/styles/05-daily-blessing-wheel.css',
  'src/styles/06-rates-summon-reveal.css',
  'src/styles/07-quests.css',
  'src/styles/08-bond.css',
  'src/styles/09-exploration-expedition.css',
  'src/styles/10-typography-collection.css',
  'src/styles/11-mailbox-handbook.css',
  'src/styles/12-themed-pools.css',
  'src/styles/13-feedback-workshop-camp.css',
]);
