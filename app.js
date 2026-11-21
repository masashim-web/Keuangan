const KAT = {
  pengeluaran: ['Celengan','Makan & Minum','Transportasi','Belanja Harian','Tagihan & Utilitas','Pulsa & Internet','Tempat Tinggal','Kesehatan','Pendidikan','Hiburan','Belanja Pribadi','Sosial & Donasi','Cicilan','Tabungan & Investasi','Lainnya'],
  pemasukan: ['Celengan','Gaji','Bonus','Freelance','Usaha','Investasi','Hadiah','Lainnya']
};

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const rp = n => (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID');
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const fmt = s => { const d = parse(s); return HARI[d.getDay()] + ' ' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inR = (t, r) => t.tanggal >= r[0] && t.tanggal <= r[1];
const sum = (a, j) => a.filter(t => t.jenis === j).reduce((s, t) => s + t.jumlah, 0);
const today = () => iso(new Date());

let DATA = [], CH = [], S = { per: 'bulan', mode: 'hari', jenis: 'pengeluaran', kat: '', edit: null, view: 'home' };

function toast(m, bad) {
  const t = $('#toast'); t.textContent = m; t.className = 'on' + (bad ? ' bad' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = '', 2600);
}

async function api(action, body = {}) {
  const url = localStorage.getItem('url');
  if (!url) throw new Error('Isi dulu URL di menu Pengaturan');
  const r = await fetch(url, { method: 'POST', body: JSON.stringify({ action, ...body }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

async function load() {
  $('#home').innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>';
  try {
    const d = await api('list');
    DATA = [...d.pemasukan.map(t => ({ ...t, jenis: 'pemasukan' })), ...d.pengeluaran.map(t => ({ ...t, jenis: 'pengeluaran' }))];
    render();
  } catch (e) {
    $('#home').innerHTML = `<div class="empty"><i>⚠️</i>${esc(e.message)}<br><br><button class="primary" onclick="load()">Coba lagi</button></div>`;
  }
}

function range() {
  const t = today(), d = new Date();
  if (S.per === 'hari') return [t, t];
  if (S.per === 'minggu') { const f = addDays(t, -((d.getDay() + 6) % 7)); return [f, addDays(f, 6)]; }
  if (S.per === 'bulan') return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  return [$('#cf').value || t, $('#ct').value || t];
}
function prevRange(r) {
  if (S.per === 'bulan') { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]; }
  const n = diff(r[0], r[1]) + 1; return [addDays(r[0], -n), addDays(r[0], -1)];
}

function render() { home(); list(); charts(); }

function home() {
  const r = range(), cur = DATA.filter(t => inR(t, r)), pr = prevRange(r), prv = DATA.filter(t => inR(t, pr));
  const inc = sum(cur, 'pemasukan'), out = sum(cur, 'pengeluaran'), pout = sum(prv, 'pengeluaran');
  const bk = {}; cur.filter(t => t.jenis === 'pengeluaran').forEach(t => bk[t.kategori] = (bk[t.kategori] || 0) + t.jumlah);
  const top = Object.entries(bk).sort((a, b) => b[1] - a[1])[0];
  const end = r[1] < today() ? r[1] : today(), days = Math.max(1, diff(r[0], end) + 1);
  const ch = pout ? (out - pout) / pout * 100 : null;
  const cl = DATA.filter(t => t.kategori.trim().toLowerCase() === 'celengan');
  const cin = sum(cl, 'pemasukan'), cout = sum(cl, 'pengeluaran');
  $('#home').innerHTML = `
  <div class="card hero"><small>Saldo bersih</small><b>${rp(inc - out)}</b>
    <div class="two"><div><small>Pemasukan</small><b>${rp(inc)}</b></div><div><small>Pengeluaran</small><b>${rp(out)}</b></div></div></div>
  <div class="card hero"><small>🐷 Celengan</small><b>${rp(cin - cout)}</b>
    <div class="two"><div><small>Pemasukan</small><b>${rp(cin)}</b></div><div><small>Pengeluaran</small><b>${rp(cout)}</b></div></div></div>
  <div class="card"><h3 style="margin:0 0 6px">Insight</h3>
    <div class="ins"><span>Pengeluaran terbesar</span><b>${top ? esc(top[0]) + ' · ' + rp(top[1]) : '-'}</b></div>
    <div class="ins"><span>Rata-rata harian</span><b>${rp(out / days)}</b></div>
    <div class="ins"><span>Vs periode lalu</span><b class="${ch > 0 ? 'up' : 'down'}">${ch === null ? 'Belum ada data pembanding' : (ch > 0 ? '▲ naik ' : '▼ turun ') + Math.abs(ch).toFixed(0) + '%'}</b></div></div>
  ${cur.length ? '' : '<div class="empty"><i>🗒️</i>Belum ada transaksi di periode ini.<br>Tekan tombol + untuk mulai mencatat.</div>'}`;
}

function list() {
  const q = $('#q').value.toLowerCase(), k = $('#fk').value, a = $('#rf1').value, b = $('#rf2').value;
  const rows = DATA.filter(t => (!k || t.kategori === k) && (!a || t.tanggal >= a) && (!b || t.tanggal <= b) &&
    (!q || (t.kategori + ' ' + t.catatan).toLowerCase().includes(q)))
    .sort((x, y) => y.tanggal.localeCompare(x.tanggal) || y.row - x.row).slice(0, 200);
  $('#list').innerHTML = rows.length ? rows.map(t => `
    <div class="item" data-id="${t.jenis}:${t.row}">
      <div class="ic ${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '−'}</div>
      <div class="mid"><b>${esc(t.kategori)}</b><small>${fmt(t.tanggal)}${t.catatan ? ' · ' + esc(t.catatan) : ''}</small></div>
      <div class="amt2 ${t.jenis}">${rp(t.jumlah)}</div></div>`).join('')
    : '<div class="empty"><i>🔍</i>Tidak ada transaksi yang cocok.</div>';
}

function bucket(mode, r) {
  const keys = [];
  if (mode === 'hari') { for (let d = r[0], i = 0; d <= r[1] && i < 62; d = addDays(d, 1), i++) keys.push(d); }
  else { const all = [...new Set(DATA.map(t => t.tanggal.slice(0, 7)))].sort(); keys.push(...all.slice(-6)); }
  const len = mode === 'hari' ? 10 : 7;
  const f = j => keys.map(k => sum(DATA.filter(t => t.tanggal.slice(0, len) === k), j));
  return { labels: keys.map(k => mode === 'hari' ? k.slice(8) + '/' + k.slice(5, 7) : k.slice(5) + '/' + k.slice(2, 4)), inc: f('pemasukan'), out: f('pengeluaran') };
}

function charts() {
  CH.forEach(c => c.destroy()); CH = [];
  const r = range(), cur = DATA.filter(t => inR(t, r) && t.jenis === 'pengeluaran');
  if (!DATA.length) { $('#charts').innerHTML = '<div class="empty"><i>📊</i>Grafik muncul setelah ada transaksi.</div>'; return; }
  $('#charts').innerHTML = ['Pengeluaran per kategori', 'Tren pengeluaran', 'Pemasukan vs pengeluaran'].map((n, i) => `<div class="card"><h3 style="margin:0 0 8px">${n}</h3><canvas id="c${i}"></canvas></div>`).join('');
  const bk = {}; cur.forEach(t => bk[t.kategori] = (bk[t.kategori] || 0) + t.jumlah);
  const e = Object.entries(bk).sort((a, b) => b[1] - a[1]);
  const pal = ['#4f7cff', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];
  const y = { ticks: { callback: v => v >= 1e6 ? v / 1e6 + 'jt' : v / 1e3 + 'rb' } }, tip = { callbacks: { label: c => ' ' + rp(c.raw) } };
  const totalK = e.reduce((s, x) => s + x[1], 0);
  const pct = v => (v / totalK * 100).toFixed(1).replace('.', ',') + '%';
  const tipPct = { callbacks: { label: c => ' ' + rp(c.raw) + ' (' + pct(c.raw) + ')' } };
  CH.push(new Chart($('#c0'), { type: 'doughnut', data: { labels: e.map(x => x[0]), datasets: [{ data: e.map(x => x[1]), backgroundColor: pal }] }, options: { plugins: { tooltip: tipPct, legend: { position: 'bottom' } } } }));
  $('#c0').parentNode.insertAdjacentHTML('beforeend', e.length
  ? e.map(x => `<div class="ins"><span>${esc(x[0])}</span><b>${rp(x[1])} (${pct(x[1])})</b></div>`).join('')
  : '<div class="empty">Belum ada pengeluaran di periode ini.</div>');
  const b = bucket(S.mode, r);
  CH.push(new Chart($('#c1'), { type: 'line', data: { labels: b.labels, datasets: [{ data: b.out, borderColor: '#8b5cf6', backgroundColor: '#8b5cf622', fill: true, tension: .35 }] }, options: { plugins: { legend: { display: false }, tooltip: tip }, scales: { y } } }));
  CH.push(new Chart($('#c2'), { type: 'bar', data: { labels: b.labels, datasets: [{ label: 'Pemasukan', data: b.inc, backgroundColor: '#10b981' }, { label: 'Pengeluaran', data: b.out, backgroundColor: '#ef4444' }] }, options: { plugins: { tooltip: tip, legend: { position: 'bottom' } }, scales: { y } } }));
}

/* ---------- Sheet tambah/edit ---------- */
function drawKats() {
  $('#kats').innerHTML = KAT[S.jenis].map(k => `<button class="${k === S.kat ? 'on' : ''}" data-k="${esc(k)}">${esc(k)}</button>`).join('');
}
function openSheet(t) {
  S.edit = t || null; S.jenis = t ? t.jenis : 'pengeluaran'; S.kat = t ? t.kategori : '';
  if (t && !KAT[S.jenis].includes(t.kategori)) KAT[S.jenis].unshift(t.kategori);
  $$('#jenis button').forEach(b => b.classList.toggle('on', b.dataset.j === S.jenis));
  $('#nom').value = t ? t.jumlah.toLocaleString('id-ID') : '';
  $('#tgl').value = t ? t.tanggal : today(); $('#cat').value = t ? t.catatan : ''; hari();
  $('#err').textContent = ''; $('#hapus').hidden = !t; $('#simpan').textContent = t ? 'Simpan Perubahan' : 'Simpan';
  drawKats(); $('#sheet').hidden = false; setTimeout(() => $('#nom').focus(), 150);
}
function hari() { $('#hr').textContent = $('#tgl').value ? '· ' + HARI[parse($('#tgl').value).getDay()] : ''; }
$('#tgl').onchange = hari;
const closeSheet = () => $('#sheet').hidden = true;

async function simpan() {
  const jumlah = Number($('#nom').value.replace(/\D/g, '')), trx = { tanggal: $('#tgl').value, kategori: S.kat, jumlah, catatan: $('#cat').value.trim() };
  const err = !(jumlah > 0) ? 'Nominal tidak boleh kosong atau 0' : !S.kat ? 'Pilih kategori dulu' : !trx.tanggal ? 'Isi tanggal' : '';
  $('#err').textContent = err; if (err) return;
  const btn = $('#simpan'); btn.disabled = true; btn.textContent = 'Menyimpan…';
  try {
    if (S.edit) {
      const o = S.edit;
      if (o.jenis !== S.jenis) { // pindah jenis: tambah di sheet baru, lalu hapus yang lama
        await api('add', { jenis: S.jenis, trx });
        await api('delete', { jenis: o.jenis, row: o.row, asli: { tanggal: o.tanggal, kategori: o.kategori, jumlah: o.jumlah } });
      } else await api('update', { jenis: S.jenis, row: o.row, trx, asli: { tanggal: o.tanggal, kategori: o.kategori, jumlah: o.jumlah } });
    } else await api('add', { jenis: S.jenis, trx });
    closeSheet(); toast('✓ Tersimpan ke spreadsheet'); load();
  } catch (e) { $('#err').textContent = e.message; toast('Gagal menyimpan', true); }
  btn.disabled = false; btn.textContent = S.edit ? 'Simpan Perubahan' : 'Simpan';
}
async function hapus() {
  const o = S.edit; if (!confirm(`Hapus transaksi ${o.kategori} sebesar ${rp(o.jumlah)}?\nTindakan ini juga menghapus baris di spreadsheet.`)) return;
  try { await api('delete', { jenis: o.jenis, row: o.row, asli: { tanggal: o.tanggal, kategori: o.kategori, jumlah: o.jumlah } }); closeSheet(); toast('✓ Transaksi dihapus'); load(); }
  catch (e) { toast(e.message, true); }
}

/* ---------- Event ---------- */
function go(v) {
  S.view = v; $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  $$('nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#perbar').hidden = !(v === 'home' || v === 'grafik'); scrollTo(0, 0);
}
$$('nav [data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
$('#fab').onclick = () => openSheet();
$('#tutup').onclick = closeSheet; $('#simpan').onclick = simpan; $('#hapus').onclick = hapus;
$('#rf').onclick = load;
$('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
$('#per').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.per = b.dataset.p; $$('#per button').forEach(x => x.classList.toggle('on', x === b)); $('#cust').hidden = S.per !== 'custom'; render(); };
$('#cf').onchange = $('#ct').onchange = render;
$('#mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.mode = b.dataset.m; $$('#mode button').forEach(x => x.classList.toggle('on', x === b)); charts(); };
$('#jenis').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.jenis = b.dataset.j; S.kat = ''; $$('#jenis button').forEach(x => x.classList.toggle('on', x === b)); drawKats(); };
$('#kats').onclick = e => { const b = e.target.closest('button'); if (b) { S.kat = b.dataset.k; drawKats(); } };
$('#nom').oninput = e => { const n = e.target.value.replace(/\D/g, ''); e.target.value = n ? Number(n).toLocaleString('id-ID') : ''; };
$('#list').onclick = e => { const it = e.target.closest('.item'); if (!it) return; const [j, r] = it.dataset.id.split(':'); openSheet(DATA.find(t => t.jenis === j && t.row === +r)); };
['#q', '#fk', '#rf1', '#rf2'].forEach(s => $(s).oninput = list);
$('#fk').innerHTML = '<option value="">Semua kategori</option>' + [...new Set([...KAT.pengeluaran, ...KAT.pemasukan])].map(k => `<option>${esc(k)}</option>`).join('');
$('#s-url').value = localStorage.getItem('url') || '';
$('#s-save').onclick = async () => {
  localStorage.setItem('url', $('#s-url').value.trim());
  try { await api('list'); toast('✓ Terhubung ke Google Sheets'); go('home'); load(); } catch (e) { toast(e.message, true); }
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && !$('#sheet').hidden && e.target.id !== 'cat') simpan(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
if (localStorage.getItem('url')) { go('home'); load(); } else { go('set'); $('#home').innerHTML = ''; }
