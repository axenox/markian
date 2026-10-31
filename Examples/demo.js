/** Show the running example's initialization source through the standalone viewer. */
const initLines = document.querySelector('script[data-editor-init]').textContent.trimEnd().split('\n');
const initIndent = initLines.find(line => line.trim()).match(/^[\t ]*/)[0];
const initSource = initLines.map(line => line.startsWith(initIndent) ? line.slice(initIndent.length) : line).join('\n').trim();
let initFence = '```';
while (initSource.includes(initFence)) initFence += '`';
window.demoInitViewer = MarkianViewer.create(document.querySelector('[data-demo-init]'), {
  markdown: `${initFence}javascript\n${initSource}\n${initFence}`,
});
const initTheme = document.querySelector('#theme');
if (initTheme) {
  const syncInitTheme = () => demoInitViewer.setTheme(initTheme.type === 'checkbox' ? (initTheme.checked ? 'dark' : 'light') : initTheme.value);
  initTheme.addEventListener('change', syncInitTheme);
  demoInitViewer.ready.then(syncInitTheme);
}