// Genera una versión de un solo archivo (scripts en línea) para publicar o compartir.
// Uso: node build-artifact.js [salida.html]
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const out = process.argv[2] || path.join(dir, 'llave-champions-2026.html');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/gi, '')
  .replace(/<\/?head>\s*/gi, '')
  .replace(/<\/?body>\s*/gi, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) =>
  '<script>\n' + fs.readFileSync(path.join(dir, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
fs.writeFileSync(out, html);
console.log('Escrito', out, (html.length / 1024).toFixed(1) + ' KB');
