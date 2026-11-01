/** Show the running example's initialization source through the standalone viewer. */
const initAssetBase = new URL('../dist/extensions/', document.currentScript.src);
const initHighlightReady = Promise.all([
  new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('languages/javascript.min.js', initAssetBase).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load example JavaScript highlighting.'));
    document.head.append(script);
  }),
  new Promise((resolve, reject) => {
    const url = new URL('code.css', initAssetBase).href;
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === url)) { resolve(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = resolve;
    link.onerror = () => reject(new Error('Could not load example syntax colors.'));
    document.head.append(link);
  }),
]);
const initLines = document.querySelector('script[data-editor-init]').textContent.trimEnd().split('\n');
const initIndent = initLines.find(line => line.trim()).match(/^[\t ]*/)[0];
const initSource = initLines.map(line => line.startsWith(initIndent) ? line.slice(initIndent.length) : line).join('\n').trim();
let initFence = '```';
while (initSource.includes(initFence)) initFence += '`';
window.demoInitViewer = MarkianViewer.create(document.querySelector('[data-demo-init]'), {
  markdown: `${initFence}javascript\n${initSource}\n${initFence}`,
  renderers: {
    javascript: async ({ source, signal }) => {
      await initHighlightReady;
      if (signal.aborted) return '';
      const tokens = await window.MarkianCodeLanguage_javascript.highlighter.highlight(source);
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = 'language-javascript';
      let offset = 0;
      for (const token of tokens) {
        code.append(document.createTextNode(source.slice(offset, token.from)));
        const span = document.createElement('span');
        span.className = token.className;
        span.textContent = source.slice(token.from, token.to);
        code.append(span);
        offset = token.to;
      }
      code.append(document.createTextNode(source.slice(offset)));
      pre.append(code);
      return pre.outerHTML;
    },
  },
});
const initTheme = document.querySelector('#theme');
if (initTheme) {
  const syncInitTheme = () => demoInitViewer.setTheme(initTheme.type === 'checkbox' ? (initTheme.checked ? 'dark' : 'light') : initTheme.value);
  initTheme.addEventListener('change', syncInitTheme);
  demoInitViewer.ready.then(syncInitTheme);
}