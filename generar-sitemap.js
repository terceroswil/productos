/* Genera sitemap.xml a partir de productos.json.
   Ejecutar cada vez que agregues productos:  node generar-sitemap.js  */

const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'productos.json'), 'utf8'));
const base = (cfg.tienda.urlBase || 'https://loscaseritos.bo').replace(/\/$/, '');
const hoy = new Date().toISOString().slice(0, 10);

const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const urls = [
  { loc: base + '/', prio: '1.0', freq: 'daily' },
  ...cfg.categorias.map(c => ({ loc: base + '/?cat=' + encodeURIComponent(c.nombre), prio: '0.7', freq: 'weekly' })),
  ...cfg.productos.map(p => ({ loc: base + '/?p=' + p.id, prio: '0.8', freq: 'weekly', img: p.img && p.img[0], titulo: p.name }))
];

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
  urls.map(u =>
    '  <url>\n' +
    '    <loc>' + xmlEsc(u.loc) + '</loc>\n' +
    '    <lastmod>' + hoy + '</lastmod>\n' +
    '    <changefreq>' + u.freq + '</changefreq>\n' +
    '    <priority>' + u.prio + '</priority>\n' +
    (u.img ? '    <image:image>\n      <image:loc>' + xmlEsc(base + '/' + u.img) + '</image:loc>\n' +
             '      <image:title>' + xmlEsc(u.titulo) + '</image:title>\n    </image:image>\n' : '') +
    '  </url>'
  ).join('\n') + '\n</urlset>\n';

fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml, 'utf8');

/* robots.txt apunta al sitemap, así que también lo mantenemos al día */
fs.writeFileSync(path.join(__dirname, 'robots.txt'),
  'User-agent: *\nAllow: /\n' +
  'Disallow: /admin.html\nDisallow: /entrar.html\nDisallow: /panel\nDisallow: /admin\nDisallow: /api/\n\n' +
  'Sitemap: ' + base + '/sitemap.xml\n', 'utf8');

console.log('✔ sitemap.xml generado con ' + urls.length + ' URLs (base: ' + base + ')');
console.log('✔ robots.txt actualizado');
