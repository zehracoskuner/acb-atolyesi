// Read-only frontend input; updates only the independent mobile API snapshot.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const docs = [
  ['terms', 'Kullanıcı Sözleşmesi', 'KullaniciSozlesmesi'],
  ['privacy', 'Gizlilik Politikası', 'GizlilikPolitikasi'],
  ['ethics', 'Etik Kurallar', 'EtikKurallar'],
].map(([id, title, filename]) => {
  const source = fs.readFileSync(path.join(root, 'frontend/src/pages', `${filename}.jsx`), 'utf8');
  const sections = [...source.matchAll(/title:\s*"([^"]+)",[\s\S]*?content:\s*`([\s\S]*?)`/g)].map(m => ({ title: m[1], content: m[2] }));
  if (!sections.length) throw new Error(`${filename}: legal section format changed; inspect before accepting.`);
  return { id, title, sections };
});
fs.writeFileSync(path.join(root, 'backend/config/mobileLegal.json'), JSON.stringify(docs, null, 2) + '\n');
console.log('Legal sections synchronized:', docs.map(d => `${d.id}: ${d.sections.length}`).join(', '));
