const KAT = {
  pengeluaran: ['Celengan','Makan & Minum','Transportasi','Belanja Harian','Tagihan & Utilitas','Pulsa & Internet','Tempat Tinggal','Kesehatan','Pendidikan','Hiburan','Belanja Pribadi','Sosial & Donasi','Cicilan','Tabungan & Investasi','Lainnya'],
  pemasukan: ['Anggaran Bulanan','Uang Bulanan','Celengan','Gaji','Bonus','Freelance','Usaha','Investasi','Hadiah','Lainnya']
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
    ALL = [...d.pemasukan.map(t => ({ ...t, jenis: 'pemasukan' })), ...d.pengeluaran.map(t => ({ ...t, jenis: 'pengeluaran' }))];
    const isRef = t => t.jenis === 'pemasukan' && t.kategori.trim().toLowerCase() === 'uang bulanan';
    REF = ALL.filter(isRef); DATA = ALL.filter(t => !isRef(t));
    STREAK = d.streak || [];
    render(); maybeFx();
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

function render() { home(); $('#home').insertAdjacentHTML('afterbegin', streakCard()); $('#home').insertAdjacentHTML('beforeend', anggaranCard()); applyHide(); list(); charts(); }

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
  <div class="card hero"><small>Celengan</small><b>${rp(cin - cout)}</b>
    <div class="two"><div><small>Pemasukan</small><b>${rp(cin)}</b></div><div><small>Pengeluaran</small><b>${rp(cout)}</b></div></div></div>
  <div class="card"><h3 style="margin:0 0 6px">Insight</h3>
    <div class="ins"><span>Pengeluaran terbesar</span><b>${top ? esc(top[0]) + ' · ' + rp(top[1]) : '-'}</b></div>
    <div class="ins"><span>Rata-rata harian</span><b>${rp(out / days)}</b></div>
    <div class="ins"><span>Vs periode lalu</span><b class="${ch > 0 ? 'up' : 'down'}">${ch === null ? 'Belum ada data pembanding' : (ch > 0 ? '▲ naik ' : '▼ turun ') + Math.abs(ch).toFixed(0) + '%'}</b></div></div>
  ${cur.length ? '' : '<div class="empty"><i>🗒️</i>Belum ada transaksi di periode ini.<br>Tekan tombol + untuk mulai mencatat.</div>'}`;
}

function list() {
  const q = $('#q').value.toLowerCase(), k = $('#fk').value, a = $('#rf1').value, b = $('#rf2').value;
  const rows = ALL.filter(t => (!k || t.kategori === k) && (!a || t.tanggal >= a) && (!b || t.tanggal <= b) &&
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
  $('#charts').insertAdjacentHTML('afterbegin', analisis(r));
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
  sisaInfo();
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

function analisis(r) {
  const isSave = k => ['celengan', 'tabungan & investasi'].includes(k.trim().toLowerCase());
  const wrap = b => `<div class="card"><h3 style="margin:0 0 6px">Evaluasi & Rekomendasi</h3>${b}</div>`;
  const row = (i, t, d) => `<div class="an"><i>${i}</i><div><b>${t}</b><small>${d}</small></div></div>`;
  const cur = DATA.filter(t => inR(t, r)), pr = prevRange(r), prv = DATA.filter(t => inR(t, pr));
  if (cur.length < 3) return wrap('<div class="empty"><i>🌱</i>Data belum cukup untuk dianalisis.<br>Catat beberapa transaksi dulu, ya.</div>');
  const kons = a => a.filter(t => t.jenis === 'pengeluaran' && !isSave(t.kategori));
  const tot = a => a.reduce((s, t) => s + t.jumlah, 0);
  const inc = sum(cur, 'pemasukan'), ek = kons(cur), K = tot(ek);
  const tab = sum(cur, 'pengeluaran') - K;
  const days = Math.max(1, diff(r[0], r[1] < today() ? r[1] : today()) + 1), pdays = diff(pr[0], pr[1]) + 1;
  const pK = tot(kons(prv));
  const L = []; let st = null, rasio = null;

  if (inc > 0) {
    const sisa = inc - K; rasio = sisa / inc * 100;
    if (rasio >= 20) { st = ['Sehat 💪', 'var(--in)']; L.push(row('✅', 'Arus kas sehat', `Kamu menyisihkan ${rasio.toFixed(0)}% dari pemasukan (${rp(sisa)}). Pertahankan!`)); }
    else if (rasio >= 0) { st = ['Perlu perhatian', '#f59e0b']; L.push(row('⚠️', 'Sisa pemasukan tipis', `Hanya ${rasio.toFixed(0)}% yang tersisa. Target umum sekitar 20%.`)); }
    else { st = ['Waspada', 'var(--out)']; L.push(row('🚨', 'Pengeluaran melebihi pemasukan', `Selisih ${rp(-sisa)} di periode ini. Cek kategori terbesar di bawah.`)); }
  } else L.push(row('💡', 'Belum ada pemasukan di periode ini', 'Catat pemasukanmu agar rasio keuangan bisa dihitung.'));

  if (tab > 0) L.push(row('🐷', `Kamu menabung ${rp(tab)}`, 'Celengan dan tabungan tidak dihitung sebagai pengeluaran harian. Bagus!'));

  const bk = {}; ek.forEach(t => bk[t.kategori] = (bk[t.kategori] || 0) + t.jumlah);
  const top = Object.entries(bk).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const p = top[1] / K * 100;
    L.push(p >= 40 ? row('⚠️', `${esc(top[0])} paling dominan`, `Menyerap ${p.toFixed(0)}% pengeluaran harianmu. Ini peluang hemat terbesar.`)
      : row('📊', `Terbesar: ${esc(top[0])} (${p.toFixed(0)}%)`, 'Pengeluaranmu cukup tersebar, tidak ada satu kategori yang mendominasi.'));
  }

  if (pK > 0) {
    const base = pK / pdays, ch = (K / days - base) / base * 100;
    L.push(Math.abs(ch) < 5 ? row('➖', 'Pengeluaran stabil', 'Rata-rata harianmu hampir sama dengan periode lalu.')
      : ch > 0 ? row('📈', `Pengeluaran harian naik ${ch.toFixed(0)}%`, 'Dibanding periode lalu. Cek kategori yang melonjak di bawah.')
      : row('📉', `Pengeluaran harian turun ${Math.abs(ch).toFixed(0)}%`, 'Dibanding periode lalu. Hebat, terus lanjutkan!'));
    const pb = {}; kons(prv).forEach(t => pb[t.kategori] = (pb[t.kategori] || 0) + t.jumlah);
    const up = Object.entries(bk).map(([k, v]) => { const b = (pb[k] || 0) / pdays, n = v / days; return [k, (n - b) * days, b ? (n - b) / b * 100 : 999]; })
      .filter(x => x[1] > 50000 && x[2] > 30).sort((a, b) => b[1] - a[1])[0];
    if (up) L.push(row('🔥', `${esc(up[0])} melonjak`, up[2] >= 999 ? 'Kategori ini baru muncul dibanding periode lalu. Adakah yang bisa ditunda?' : `Naik ${up[2].toFixed(0)}% per hari dibanding periode lalu. Adakah yang bisa ditunda?`));
  }

  if (diff(r[0], r[1]) >= 2) {
    const d = {}; ek.forEach(t => d[t.tanggal] = (d[t.tanggal] || 0) + t.jumlah);
    const m = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
    if (m && m[1] > 1.5 * K / days) L.push(row('📅', `Hari terboros: ${fmt(m[0])}`, `${rp(m[1])}. Coba ingat pemicunya supaya bisa diantisipasi.`));
  }

  if (S.per === 'bulan' && days >= 5 && r[1] >= today()) {
    const proj = K / days * (diff(r[0], r[1]) + 1);
    L.push(row('🔮', `Proyeksi pengeluaran akhir bulan: ${rp(proj)}`, inc > 0 && proj > inc ? `Dengan laju sekarang, bisa melebihi pemasukan bulan ini (${rp(inc)}).` : 'Berdasarkan laju harianmu saat ini, belum termasuk tabungan.'));
  }

  const urut = Object.entries(bk).sort((a, b) => b[1] - a[1]);
  const flek = ['hiburan', 'belanja pribadi', 'makan & minum', 'sosial & donasi', 'lainnya'];
  const wajib = ['tempat tinggal', 'tagihan & utilitas', 'cicilan', 'kesehatan', 'pendidikan', 'pulsa & internet'];
  const jenisK = k => wajib.includes(k.trim().toLowerCase()) ? 'wajib' : flek.includes(k.trim().toLowerCase()) ? 'flek' : 'lain';
  const potensi = urut.filter(x => jenisK(x[0]) !== 'wajib').reduce((s, x) => s + x[1] * .1, 0);

  if (rasio === null) L.push(row('🎯', 'Rekomendasi', 'Catat pemasukanmu dulu supaya evaluasi bisa lebih akurat.'));
  else if (rasio >= 20) L.push(row('🌟', 'Apresiasi', `Disiplinmu terlihat: ${rasio.toFixed(0)}% pemasukan masih tersisa. Meski sudah sehat, tetap ada ruang perbaikan di bawah ini supaya tabunganmu makin kuat.`));
  else if (rasio >= 0) L.push(row('🎯', 'Target: sisa 20% pemasukan', `Kamu perlu menghemat sekitar ${rp(K - inc * .8)} lagi di periode ini untuk mencapainya. Kamu sudah dekat, jadi fokus pada pos di bawah ini.`));
  else L.push(row('🚨', 'Prioritas: tutup defisit', `Kurangi pengeluaran minimal ${rp(K - inc)} atau tambah pemasukan. Tunda dulu pembelian yang bukan kebutuhan wajib.`));

  urut.slice(0, 3).forEach(([k, v], i) => {
    const p = v / K * 100, j = jenisK(k), h = v * .1;
    const saran = j === 'wajib' ? 'Termasuk kebutuhan wajib. Cek apakah ada tagihan atau langganan yang bisa dinegosiasikan atau diganti paket lebih murah.'
      : j === 'flek' ? `Pos yang bisa diatur. Kurangi 10% = hemat ${rp(h)} (sekitar ${rp(h / days)} per hari).`
      : `Pantau polanya: cari transaksi yang paling sering atau paling besar, lalu tentukan batas per minggu. Hemat 10% = ${rp(h)}.`;
    L.push(row(['🥇', '🥈', '🥉'][i], `${esc(k)}: ${rp(v)} (${p.toFixed(0)}%)`, saran));
  });

  if (K > 0) {
    let pen;
    if (rasio !== null && rasio >= 20) pen = `Pindahkan ${rp((inc - K) * .5)} (setengah dari sisa) ke Celengan lebih dulu, lalu coba hemat 10% di pos non-wajib. Potensi tambahan ${rp(potensi)}.`;
    else if (rasio !== null) {
      const gap = rasio >= 0 ? K - inc * .8 : K - inc;
      pen = `Hemat 10% di semua pos non-wajib = ${rp(potensi)}. ` + (potensi >= gap ? 'Ini sudah cukup untuk mencapai targetmu.' : 'Belum cukup sendirian, pertimbangkan menunda pembelian besar atau menambah pemasukan.');
    } else pen = `Mulai dengan hemat 10% di pos non-wajib. Potensinya ${rp(potensi)}.`;
    L.push(row('🎯', 'Langkah berikutnya', pen));
  }

  return wrap((st ? `<span class="st" style="color:${st[1]}">${st[0]}</span>` : '') + L.join('') +
    '<small style="color:var(--m)">Analisis berdasarkan catatanmu pada periode yang dipilih.</small>');
}

let STREAK = [];
const STH = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function streakInfo() {
  const t = today();
  const rec = new Set([...DATA.map(x => x.tanggal), ...STREAK.filter(x => x.jenis === 'Kosong').map(x => x.tanggal)]);
  const sh = new Set(STREAK.filter(x => x.jenis === 'Tameng').map(x => x.tanggal));
  const all = [...rec, ...sh].filter(d => d <= t).sort();
  const I = { t, rec, sh, n: 0, best: 0, tameng: 0, done: rec.has(t) || sh.has(t), gaps: [], first: all[0] || t };
  if (!all.length) return I;
  const lim = addDays(t, -365);
  let n = 0;
  for (let d = all[0] < lim ? lim : all[0]; d <= t; d = addDays(d, 1)) {
    if (rec.has(d)) { n++; if (n % 7 === 0) I.tameng = Math.min(2, I.tameng + 1); }
    else if (sh.has(d)) { n++; I.tameng = Math.max(0, I.tameng - 1); }
    else if (d < t) n = 0;
    I.best = Math.max(I.best, n);
  }
  I.n = n;
  for (let i = 3; i >= 1; i--) { const d = addDays(t, -i); if (d > I.first && !rec.has(d) && !sh.has(d)) I.gaps.push(d); }
  return I;
}

function strip(I) {
  let h = '';
  for (let i = 6; i >= 0; i--) {
    const d = addDays(I.t, -i);
    const s = I.rec.has(d) ? 'on' : I.sh.has(d) ? 'sh' : d === I.t ? 'now' : d < I.first ? 'no' : 'miss';
    h += `<div class="cw"><div class="cn ${s}" style="--i:${6 - i}">${s === 'sh' ? '🛡️' : s === 'on' ? 'Rp' : ''}</div><small>${STH[parse(d).getDay()]}</small></div>`;
  }
  return h;
}

function streakCard() {
  const I = streakInfo();
  const msg = I.done ? 'Aman untuk hari ini ✓ Sampai ketemu besok!'
    : I.n > 0 ? `Catat hari ini supaya streak ${I.n} harimu berlanjut.`
    : I.best > 0 ? `Mulai lagi hari ini. Rekormu ${I.best} hari, pasti bisa kamu kejar!`
    : 'Catat transaksi pertamamu hari ini untuk memulai streak.';
  const gaps = I.gaps.map(d => `<div class="gap"><span>⚠️ ${STH[parse(d).getDay()]} ${d.slice(8)}/${d.slice(5, 7)} terlewat</span><button data-a="tameng" data-d="${d}">🛡️ Tameng</button><button data-a="isi" data-d="${d}">Isi catatan</button></div>`).join('');
  return `<div class="card" id="stc" style="cursor:pointer"><div class="stk"><div class="sn"><b>${I.n}</b><span>hari streak uang</span></div><small style="color:var(--m)">Rekor ${I.best} · 📅</small></div>
    <div class="cs">${strip(I)}</div><div style="font-size:14px">${msg}</div>
    ${I.done ? '' : '<button class="ghost" data-a="kosong" style="margin-top:10px;padding:12px;font-size:15px">Tidak ada transaksi hari ini</button>'}
    ${gaps}
    <div class="sw">${'🛡️'.repeat(I.tameng)}${'<span style="opacity:.25">🛡️</span>'.repeat(2 - I.tameng)} Tameng · dapat 1 tiap kelipatan 7 hari (maks 2)</div></div>`;
}

function maybeFx() {
  const I = streakInfo();
  if (!I.done || I.n < 1 || localStorage.getItem('fxDay') === I.t) return;
  localStorage.setItem('fxDay', I.t);
  let fx = $('#fx');
  if (!fx) { fx = document.createElement('div'); fx.id = 'fx'; document.body.appendChild(fx); }
  const cap = I.n % 7 === 0 ? `🎉 ${I.n} hari! Kamu dapat Tameng baru 🛡️` : I.n === 1 ? 'Streak dimulai! Besok lanjut lagi ya.' : `Kamu mencatat ${I.n} hari berturut-turut. Keren!`;
  const rain = Array.from({ length: Math.min(I.n, 30) }, () => `<i class="rain" style="left:${Math.random() * 94}%;animation-duration:${2.4 + Math.random() * 2}s;animation-delay:${Math.random() * 1.4}s"></i>`).join('');
  fx.innerHTML = rain + `<div class="fxb"><div class="fxn">0</div><div style="font-weight:600;font-size:20px;margin:4px 0 18px">hari streak uang</div><div class="cs">${strip(I)}</div><p>${cap}</p><small style="color:var(--m)">Ketuk untuk menutup</small></div>`;
  fx.hidden = false;
  const el = fx.querySelector('.fxn'), step = Math.max(1, Math.ceil(I.n / 20));
  let i = 0;
  const iv = setInterval(() => { i = Math.min(I.n, i + step); el.textContent = i; if (i >= I.n) clearInterval(iv); }, 45);
  const close = () => { fx.hidden = true; clearInterval(iv); clearTimeout(tm); };
  const tm = setTimeout(close, 5500);
  fx.onclick = close;
}

async function stCek(d, kind, ok) {
  try { await api('streak', { tanggal: d, kind }); toast(ok); load(); } catch (e) { toast(e.message, true); }
}
$('#home').onclick = e => {
  const hc = e.target.closest('[data-hk]');
  if (hc) return toggleHide(hc.dataset.hk);
  const b = e.target.closest('[data-a]');
  if (!b) { if (e.target.closest('#stc')) openCal(); return; }
  const a = b.dataset.a, d = b.dataset.d;
  if (a === 'kosong') stCek(today(), 'Kosong', '✓ Tercatat: tidak ada transaksi hari ini');
  if (a === 'tameng') {
    if (streakInfo().tameng < 1) return toast('Belum punya Tameng. Isi catatan untuk tanggal itu saja.', true);
    stCek(d, 'Tameng', '🛡️ Streak diselamatkan!');
  }
  if (a === 'isi') { openSheet(); $('#tgl').value = d; if (typeof hari === 'function') hari(); }
};

const ANGGARAN = {
  'Celengan': 20, 'Makan & Minum': 35, 'Transportasi': 10, 'Pulsa & Internet': 8,
  'Belanja Harian': 5, 'Hiburan': 7, 'Belanja Pribadi': 5, 'Sosial & Donasi': 3,
  'Kesehatan': 2, 'Lainnya': 5
};

function budgetCard() {
  const d = new Date(), a = iso(new Date(d.getFullYear(), d.getMonth(), 1)), b = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const m = DATA.filter(t => t.tanggal >= a && t.tanggal <= b);
  const same = (t, k) => t.kategori.trim().toLowerCase() === k.toLowerCase();
  const tot = arr => arr.reduce((s, t) => s + t.jumlah, 0);
  const base = tot(m.filter(t => t.jenis === 'pemasukan' && same(t, 'Uang Bulanan')));
  const head = '<h3 style="margin:0 0 6px">Anggaran Bulan Ini</h3>';
  if (!base) return `<div class="card">${head}<div class="empty" style="padding:16px"><i>💸</i>Catat pemasukan kategori <b>Uang Bulanan</b> untuk membuat pembagian anggaran otomatis.</div></div>`;
  const sisaHari = Math.max(1, diff(today(), b) + 1);
  const rows = Object.entries(ANGGARAN).map(([k, p]) => {
    const jatah = base * p / 100, ce = k === 'Celengan';
    const pakai = tot(m.filter(t => same(t, k) && t.jenis === (ce ? 'pemasukan' : 'pengeluaran')));
    const pct = pakai / jatah * 100;
    const cls = ce ? '' : pct > 100 ? 'x' : pct >= 75 ? 'w' : '';
    const note = ce ? (pakai >= jatah ? 'Target menabung tercapai 🎉' : `Kurang ${rp(jatah - pakai)} lagi untuk target`)
      : pakai > jatah ? `Lewat ${rp(pakai - jatah)} dari jatah`
      : `Sisa ${rp(jatah - pakai)} · sekitar ${rp((jatah - pakai) / sisaHari)} per hari`;
    return `<div class="bgr"><div><b>${esc(k)} <span style="color:var(--m);font-weight:400">${p}%</span></b><span>${rp(pakai)} / ${rp(jatah)}</span></div>
      <div class="bar"><i class="${cls}" style="width:${Math.min(100, pct)}%"></i></div><small>${note}</small></div>`;
  }).join('');
  const luar = tot(m.filter(t => t.jenis === 'pengeluaran' && !Object.keys(ANGGARAN).some(k => same(t, k))));
  return `<div class="card">${head}<small style="color:var(--m)">Dari Uang Bulanan ${rp(base)}</small>${rows}
    ${luar ? `<div class="ins"><span>Di luar anggaran</span><b>${rp(luar)}</b></div>` : ''}</div>`;
}

let ALL = [], REF = [];

function budgetData() {
  const d = new Date(), a = iso(new Date(d.getFullYear(), d.getMonth(), 1)), b = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const inM = t => t.tanggal >= a && t.tanggal <= b;
  const tot = arr => arr.reduce((s, t) => s + t.jumlah, 0);
  const same = (t, k) => t.kategori.trim().toLowerCase() === k.toLowerCase();
  const base = tot(REF.filter(inM));
  const items = Object.entries(ANGGARAN).map(([k, p]) => {
    const ce = k === 'Celengan', jatah = base * p / 100;
    const pakai = tot(DATA.filter(t => inM(t) && same(t, k) && t.jenis === (ce ? 'pemasukan' : 'pengeluaran')));
    return { k, p, ce, jatah, pakai };
  });
  const luar = tot(DATA.filter(t => inM(t) && t.jenis === 'pengeluaran' && !Object.keys(ANGGARAN).some(k => same(t, k))));
  return { a, b, base, items, luar };
}

function anggaranCard() {
  const B = budgetData(), head = '<h3 style="margin:0 0 6px">Anggaran Bulan Ini</h3>';
  if (!B.base) return `<div class="card">${head}<div class="empty" style="padding:16px"><i>💸</i>Catat pemasukan kategori <b>Uang Bulanan</b> untuk membuat pembagian anggaran otomatis.</div></div>`;
  const sisaHari = Math.max(1, diff(today(), B.b) + 1);
  const rows = B.items.map(({ k, p, ce, jatah, pakai }) => {
    const pct = pakai / jatah * 100;
    const cls = ce ? '' : pct > 100 ? 'x' : pct >= 75 ? 'w' : '';
    const note = ce ? (pakai >= jatah ? 'Target menabung tercapai 🎉' : `Kurang ${rp(jatah - pakai)} lagi untuk target`)
      : pakai > jatah ? `Lewat ${rp(pakai - jatah)} dari jatah`
      : `Sisa ${rp(jatah - pakai)} · sekitar ${rp((jatah - pakai) / sisaHari)} per hari`;
    return `<div class="bgr"><div><b>${esc(k)} <span style="color:var(--m);font-weight:400">${p}%</span></b><span>${rp(pakai)} / ${rp(jatah)}</span></div>
      <div class="bar"><i class="${cls}" style="width:${Math.min(100, pct)}%"></i></div><small>${note}</small></div>`;
  }).join('');
  const sp = B.items.filter(x => !x.ce);
  const J = sp.reduce((s, x) => s + x.jatah, 0), P = sp.reduce((s, x) => s + x.pakai, 0);
  const wkt = (diff(B.a, today()) + 1) / (diff(B.a, B.b) + 1) * 100, pem = P / J * 100;
  const lewat = sp.filter(x => x.pakai > x.jatah).map(x => esc(x.k));
  const status = lewat.length ? `⚠️ Melebihi jatah: ${lewat.join(', ')}`
    : pem <= wkt ? `✅ Di jalur: terpakai ${pem.toFixed(0)}% dari jatah, bulan berjalan ${wkt.toFixed(0)}%`
    : `⚠️ Terpakai ${pem.toFixed(0)}% padahal bulan baru berjalan ${wkt.toFixed(0)}%. Rem sedikit ya.`;
  return `<div class="card">${head}<small style="color:var(--m)">Acuan: Uang Bulanan ${rp(B.base)} (tidak masuk Saldo bersih)</small>
    <div style="margin:10px 0 4px;font-size:14px;font-weight:600">${status}</div>${rows}
    ${B.luar ? `<div class="ins"><span>Di luar anggaran</span><b>${rp(B.luar)}</b></div>` : ''}</div>`;
}

function sisaInfo() {
  let el = $('#sisa');
  if (!el) { el = document.createElement('div'); el.id = 'sisa'; $('#kats').after(el); }
  el.className = 'sisa'; el.textContent = '';
  if (!S.kat) return;
  const kn = S.kat.trim().toLowerCase();
  if (S.jenis === 'pemasukan' && kn === 'uang bulanan') { el.textContent = 'ℹ️ Uang Bulanan hanya acuan anggaran, tidak masuk Saldo bersih.'; return; }
  const B = budgetData(); if (!B.base) return;
  const it = B.items.find(x => x.k.toLowerCase() === kn && x.ce === (S.jenis === 'pemasukan'));
  if (!it) return;
  const o = S.edit, own = o && o.jenis === S.jenis && o.kategori.trim().toLowerCase() === kn && o.tanggal >= B.a && o.tanggal <= B.b ? o.jumlah : 0;
  const pakai = it.pakai - own, amt = Number($('#nom').value.replace(/\D/g, '')) || 0, sisa = it.jatah - pakai - amt;
  if (it.ce) { el.textContent = `🎯 Target celengan ${rp(it.jatah)} · ` + (sisa > 0 ? `kurang ${rp(sisa)}` : 'tercapai 🎉'); return; }
  el.textContent = `Jatah ${it.k}: sisa ${rp(it.jatah - pakai)}` + (amt ? (sisa >= 0 ? ` → setelah ini ${rp(sisa)}` : ` → lewat ${rp(-sisa)} dari jatah`) : '');
  if (sisa < 0) el.className = 'sisa bad';
}

const BLN = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); };
const addM = (ym, k) => { const [y, m] = ym.split('-').map(Number); return iso(new Date(y, m - 1 + k, 1)).slice(0, 7); };

function calHTML(I, ym) {
  const [y, m] = ym.split('-').map(Number), first = iso(new Date(y, m - 1, 1)), nd = new Date(y, m, 0).getDate();
  const off = (parse(first).getDay() + 6) % 7, weeks = Math.ceil((off + nd) / 7), cur = I.t.slice(0, 7);
  const mark = d => I.rec.has(d) || I.sh.has(d);
  let g = ['S', 'S', 'R', 'K', 'J', 'S', 'M', ''].map(x => `<div class="ch">${x}</div>`).join(''), cnt = 0;
  for (let w = 0; w < weeks; w++) {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(first, w * 7 + i - off), inM = d.slice(0, 7) === ym;
      const cls = !inM ? 'o' : I.rec.has(d) ? 'on' : I.sh.has(d) ? 'sh' : d === I.t ? 'now' : d > I.t ? 'fu' : d > I.first ? 'miss' : '';
      if (inM && mark(d)) cnt++;
      if (mark(d)) n++;
      g += `<div class="cd ${cls}${d === I.t ? ' td' : ''}">${cls === 'sh' ? '🛡️' : +d.slice(8)}</div>`;
    }
    g += `<div class="wk ${n === 7 ? 'ok' : ''}">${n === 7 ? '✓' : n + '/7'}</div>`;
  }
  const prev = ym > I.first.slice(0, 7) ? addM(ym, -1) : '', next = ym < cur ? addM(ym, 1) : '';
  const gaps = ym === cur ? I.gaps.map(d => `<div class="gap"><span>⚠️ ${STH[parse(d).getDay()]} ${d.slice(8)}/${d.slice(5, 7)} terlewat</span><button data-a="tameng" data-d="${d}">🛡️ Tameng</button><button data-a="isi" data-d="${d}">Isi catatan</button></div>`).join('') : '';
  return `<div class="panel">
    <div class="cnav"><button data-cm="${prev}" ${prev ? '' : 'disabled'}>‹</button><b>${BLN(ym)}</b><button data-cm="${next}" ${next ? '' : 'disabled'}>›</button></div>
    <div class="cst"><div><small>Streak sekarang</small><b>🔥 ${I.n} hari</b></div><div><small>Rekor</small><b>${I.best} hari</b></div><div><small>Tercatat bulan ini</small><b>${cnt} hari</b></div></div>
    <div class="cg">${g}</div>
    <div class="leg">🟡 Tercatat · 🛡️ Tameng · 🔴 Terlewat · ⚪ Belum</div>
    ${gaps}
    <button class="ghost" data-x>Tutup</button></div>`;
}

function openCal(ym) {
  const I = streakInfo();
  let el = $('#cal');
  if (!el) {
    el = document.createElement('div'); el.id = 'cal'; document.body.appendChild(el);
    el.onclick = e => {
      if (e.target.id === 'cal' || e.target.closest('[data-x]')) return closeCal();
      const nv = e.target.closest('[data-cm]');
      if (nv) return nv.dataset.cm && openCal(nv.dataset.cm);
      if (e.target.closest('[data-a]')) { closeCal(); $('#home').onclick(e); }
    };
  }
  el.innerHTML = calHTML(I, ym || I.t.slice(0, 7)); el.hidden = false;
}
function closeCal() { const el = $('#cal'); if (el) el.hidden = true; }

const HIDE = () => { try { return JSON.parse(localStorage.getItem('hide')) || {}; } catch (e) { return {}; } };
function applyHide() {
  const h = HIDE();
  $$('#home .hero').forEach(c => {
    const s = (c.querySelector('small') || {}).textContent || '';
    const k = s.includes('Saldo bersih') ? 'saldo' : s.includes('Celengan') ? 'celengan' : '';
    if (!k) return;
    const o = c.querySelector('.eye'); if (o) o.remove();
    c.dataset.hk = k; c.classList.toggle('hid', !!h[k]);
    c.insertAdjacentHTML('afterbegin', `<span class="eye">${h[k] ? '🙈' : '👁️'}</span>`);
  });
}
function toggleHide(k) {
  const h = HIDE(); h[k] = !h[k];
  try { localStorage.setItem('hide', JSON.stringify(h)); } catch (e) {}
  applyHide();
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
$('#nom').oninput = e => { const n = e.target.value.replace(/\D/g, ''); e.target.value = n ? Number(n).toLocaleString('id-ID') : ''; sisaInfo(); };
$('#list').onclick = e => { const it = e.target.closest('.item'); if (!it) return; const [j, r] = it.dataset.id.split(':'); openSheet(ALL.find(t => t.jenis === j && t.row === +r)); };
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
