const host = document.querySelector('#example');
window.example = Markian.create(host, { markdown: host.value });
const show = () => { document.querySelector('#submitted').textContent = new FormData(document.querySelector('form')).get('notes'); };
example.on('change', show);
example.ready.then(show);
document.querySelector('#destroy').addEventListener('click', () => example.destroy());