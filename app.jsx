const { useState, useEffect, useMemo } = React;

/* ================= KONFIGURATION ================= */
const APP_VERSION = '1.0';
const CONFIG = {
  MAIL_TO: 'd.dasilva@hetec-gmbh.de',
  MAIL_CC: '',                                   // z.B. 'b.sacher@hetec-gmbh.de, s.hitzler@hetec-gmbh.de'
  ADMIN_EMAILS: ['d.dasilva@hetec-gmbh.de'],     // muss mit firestore.rules übereinstimmen
  FRUEH_BIS_STUNDE: 14,
  FOTO_TAGE: 30,
  FOTO_MAX: 6
};
const firebaseConfig = {
  apiKey: "AIzaSyAbqk60gjtsumJIIjH9syoKxS9PlpQFnR4",
  authDomain: "kassen-ae180.firebaseapp.com",
  projectId: "kassen-ae180",
  storageBucket: "kassen-ae180.firebasestorage.app",
  messagingSenderId: "599150345362",
  appId: "1:599150345362:web:9fcc6113b3c9b0d2fe7a4b"
};
const SHOPS = [
  { id:'o2-aalen',               name:'o2 Aalen',               brand:'o2',      kassen:['Kasse 1','Kasse 2'] },
  { id:'o2-sindelfingen',        name:'o2 Sindelfingen',        brand:'o2',      kassen:['Kasse 1','Kasse 2'] },
  { id:'o2-crailsheim',          name:'o2 Crailsheim',          brand:'o2',      kassen:['Kasse 1'] },
  { id:'o2-schwaebisch-hall',    name:'o2 Schwäbisch Hall',     brand:'o2',      kassen:['Kasse 1'] },
  { id:'o2-stuttgart-vaihingen', name:'o2 Stuttgart Vaihingen', brand:'o2',      kassen:['Kasse 1'] },
  { id:'telekom-crailsheim',     name:'Telekom Crailsheim',     brand:'telekom', kassen:['Kasse 1'] }
];
/* ================================================= */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.enablePersistence({ synchronizeTabs:true }).catch(() => {});
const TS = firebase.firestore.Timestamp;
const colP = shopId => db.collection('shops').doc(shopId).collection('protokolle');
const colF = shopId => db.collection('shops').doc(shopId).collection('fotos');

const NOTES = [200,100,50,20,10,5];
const COINS = [2,1,0.5,0.2,0.1,0.05,0.02,0.01];
const ROLLS = [{v:2,n:25},{v:1,n:25},{v:0.5,n:40},{v:0.2,n:40},{v:0.1,n:40},{v:0.05,n:50},{v:0.02,n:50},{v:0.01,n:50}];
const VOUCHERS = [15,20,30];

const fmt = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const isOk = d => Math.abs(d) < 0.005;
const eur = x => fmt.format(x || 0);
const eurS = x => (x > 0.004 ? '+' : '') + fmt.format(x || 0);
const coinLbl = v => v >= 1 ? `${v} €` : `${Math.round(v*100)} ct`;
const toIn = n => (n || n === 0) ? Number(n).toFixed(2).replace('.', ',') : '';
const parseEuro = s => {
  if (typeof s === 'number') return s;
  s = String(s || '').trim().replace(/\s|€/g,'');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g,'').replace(',', '.');
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
};
const parseCount = s => Math.max(0, (String(s ?? '').match(/[+-]?\d+/g) || []).reduce((a,x) => a + parseInt(x,10), 0));
const dt = t => new Date(t).toLocaleString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const dFull = t => new Date(t).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const dDay = t => new Date(t).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
const sameDay = (a,b) => new Date(a).toDateString() === new Date(b).toDateString();
const ROOT = new URL('.', document.baseURI).href;                 // https://hetec-it.github.io/kassenzaehlprotokoll/
const PAGE_SHOP = SHOPS.find(s => location.pathname.toLowerCase().split('/').includes(s.id));
const shopById = id => SHOPS.find(s => s.id === id);
const kasseLbl = (shop,k) => shop.kassen.length > 1 ? ` ${k}` : '';
const isAdminUser = u => !!(u && !u.isAnonymous && u.email && CONFIG.ADMIN_EMAILS.map(x => x.toLowerCase()).includes(u.email.toLowerCase()));
const hashOpen = () => new URLSearchParams(location.hash.replace(/^#/,'')).get('open') || '';
const ls = {
  get(k,d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};

const GROUPS = [
  { key:'n', title:'Scheine',    items: NOTES.map(v => ({ label:`${v} €`, unit:v })) },
  { key:'c', title:'Münzen',     items: COINS.map(v => ({ label:coinLbl(v), unit:v })) },
  { key:'r', title:'Münzrollen', items: ROLLS.map(r => ({ label:coinLbl(r.v), hint:`Rolle ${r.n} St. = ${eur(r.v*r.n)}`, unit:r2(r.v*r.n) })) },
  { key:'v', title:'Voucher',    items: VOUCHERS.map(v => ({ label:`${v} €`, hint:'Voucher', unit:v })) }
];
const emptyCounts = () => Object.fromEntries(GROUPS.map(g => [g.key, g.items.map(() => '')]));
const countsToStr = c => Object.fromEntries(GROUPS.map(g => [g.key, g.items.map((_,i) => { const n = parseCount((c && c[g.key] || [])[i]); return n ? String(n) : ''; })]));
const countsToNum = c => Object.fromEntries(GROUPS.map(g => [g.key, g.items.map((_,i) => parseCount((c && c[g.key] || [])[i]))]));
function totals(counts){
  const t = {}; let ist = 0;
  GROUPS.forEach(g => {
    let c = 0;
    g.items.forEach((it,i) => { c += Math.round(it.unit*100) * parseCount((counts[g.key] || [])[i]); });
    t[g.key] = c/100; ist += c;
  });
  t.ist = ist/100; return t;
}
function makeProtocol(x){
  const counts = countsToNum(x.counts);
  const ist = totals(counts).ist;
  const soll = r2(parseEuro(x.soll)), open = r2(parseEuro(x.open));
  return { id:`${x.kasse.replace(/\s+/g,'')}_${x.t}`, shop:x.shop, kasse:x.kasse, t:x.t, schicht:x.schicht,
    soll, open, counts, ist, diff:r2(ist - soll + open), bemerkung:x.bemerkung || '', name:x.name || '',
    source:x.source || 'shop', fotos:x.fotos || 0, by:(auth.currentUser && auth.currentUser.email) || '' };
}

/* ---------- Firestore ---------- */
function saveProtocol(p, fotos){
  const { id, ...data } = p;
  const ops = [colP(p.shop).doc(id).set({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() })];
  (fotos || []).forEach((f,i) => ops.push(colF(p.shop).doc(`${id}_${i}`).set({
    protokollId:id, kasse:p.kasse, t:p.t, data:f, expireAt: TS.fromMillis(p.t + CONFIG.FOTO_TAGE*864e5) })));
  return Promise.all(ops); // offline: wird gepuffert und später übertragen
}
function useProtocols(shopIds){
  const [state, setState] = useState({ list:[], loading:true, error:'' });
  const key = shopIds.join(',');
  useEffect(() => {
    const parts = {}; const got = new Set();
    const emit = () => setState({ list:Object.values(parts).flat().sort((a,b) => a.t - b.t), loading:got.size < shopIds.length, error:'' });
    const unsubs = shopIds.map(id => colP(id).orderBy('t','desc').limit(400).onSnapshot({ includeMetadataChanges:true },
      snap => {
        parts[id] = snap.docs.map(d => ({ ...d.data(), id:d.id, _pending:d.metadata.hasPendingWrites }));
        got.add(id); emit();
      },
      err => setState(s => ({ ...s, loading:false, error: err.code === 'permission-denied' ? 'Keine Berechtigung – Firestore-Regeln prüfen.' : err.message }))
    ));
    return () => unsubs.forEach(u => u());
  }, [key]);
  return state;
}
async function cleanupFotos(){
  const now = TS.now();
  for (const s of SHOPS) {
    try {
      const snap = await colF(s.id).where('expireAt','<',now).limit(200).get();
      await Promise.all(snap.docs.map(d => d.ref.delete()));
    } catch(e){}
  }
}

/* ---------- Mail ---------- */
function buildMail(p){
  const shop = shopById(p.shop);
  const ok = isOk(p.diff);
  const subject = ok
    ? `Kassenprotokoll ${shop.name}${kasseLbl(shop,p.kasse)} – ${p.schicht} ${dDay(p.t)} – Kasse OK`
    : `ACHTUNG: Kasse ${shop.name}${kasseLbl(shop,p.kasse)} passt nicht – Soll zu Ist ${eurS(p.diff)}`;
  const L = [];
  if (!ok) L.push('!!! ACHTUNG: KASSE PASST NICHT – SOLL ZU IST !!!', '');
  L.push(`Kassenzählprotokoll ${shop.name} – ${p.kasse}`, `${p.schicht} · ${dFull(p.t)}`, `Gezählt von: ${p.name}`, '');
  L.push(`Soll:      ${eur(p.soll)}`, `Ist:       ${eur(p.ist)}`);
  if (p.open) L.push(`Bekannter Fehlbetrag: ${eur(p.open)}`);
  L.push(`Differenz: ${eurS(p.diff)}  ${ok ? '✔ Kasse OK' : '✖ Kasse NICHT OK'}`);
  if (p.bemerkung) L.push('', `Bemerkung: ${p.bemerkung}`);
  if (p.fotos) L.push('', `Fotos: ${p.fotos} (in der App, ${CONFIG.FOTO_TAGE} Tage gespeichert)`);
  const tt = totals(p.counts);
  GROUPS.forEach(g => {
    const rows = g.items.map((it,i) => ({ it, n:p.counts[g.key][i] })).filter(x => x.n > 0);
    if (!rows.length) return;
    L.push('', `${g.title} (${eur(tt[g.key])})`);
    rows.forEach(({it,n}) => L.push(`  ${it.label}${g.key==='r' ? ' Rolle' : g.key==='v' ? ' Voucher' : ''} × ${n} = ${eur(it.unit*n)}`));
  });
  L.push('', 'In der App öffnen:', `${ROOT}#open=${p.shop}`);
  const body = L.join('\n');
  const cc = CONFIG.MAIL_CC ? `cc=${encodeURIComponent(CONFIG.MAIL_CC)}&` : '';
  return { subject, body, href:`mailto:${CONFIG.MAIL_TO}?${cc}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
function copyText(t, done){
  const fb = () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done && done(); } catch(e){} a.remove(); };
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => done && done(), fb); else fb();
}

/* ---------- Fotos ---------- */
function shrink(file, max = 640, q = 0.6){
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = rej; img.src = url;
  });
}
function Lightbox({ src, onClose }){
  if (!src) return null;
  return <div className="lightbox" onClick={onClose} role="dialog" aria-label="Foto"><img src={src} alt="Foto" /></div>;
}
function FotoInput({ fotos, setFotos }){
  const [big, setBig] = useState(null);
  async function pick(e){
    const files = [...e.target.files].slice(0, CONFIG.FOTO_MAX - fotos.length); e.target.value = '';
    const out = [];
    for (const f of files) { try { out.push(await shrink(f)); } catch(x){} }
    setFotos(a => [...a, ...out].slice(0, CONFIG.FOTO_MAX));
  }
  return (
    <details className="card" style={{marginTop:12}}>
      <summary className="fsum"><span>Fotos (optional)</span><span className="muted small">{fotos.length ? `${fotos.length} Foto(s)` : 'antippen'}</span></summary>
      <p className="muted small" style={{marginTop:8}}>Nur bei Bedarf, z. B. als Beleg bei Differenz. Wird {CONFIG.FOTO_TAGE} Tage als Miniatur gespeichert.</p>
      {fotos.length < CONFIG.FOTO_MAX && <div className="btns">
        <label className="btn ghost" style={{textAlign:'center'}}>Foto aufnehmen<input type="file" accept="image/*" capture="environment" hidden onChange={pick} /></label>
        <label className="btn ghost" style={{textAlign:'center'}}>Aus Galerie<input type="file" accept="image/*" multiple hidden onChange={pick} /></label>
      </div>}
      {!!fotos.length && <div className="fotos">{fotos.map((f,i) =>
        <div className="th" key={i}><img src={f} alt={`Foto ${i+1}`} onClick={() => setBig(f)} /><button onClick={() => setFotos(a => a.filter((_,j) => j !== i))} aria-label="Foto entfernen">✕</button></div>)}</div>}
      <Lightbox src={big} onClose={() => setBig(null)} />
    </details>
  );
}
function FotoView({ p }){
  const [imgs, setImgs] = useState(null); const [big, setBig] = useState(null);
  useEffect(() => {
    colF(p.shop).where('protokollId','==',p.id).get()
      .then(s => setImgs(s.docs.map(d => d.data()).sort((a,b) => a.t - b.t).map(d => d.data)))
      .catch(() => setImgs([]));
  }, [p.id]);
  if (imgs === null) return <p className="muted small">Fotos werden geladen …</p>;
  if (!imgs.length) return <p className="muted small">Fotos nach {CONFIG.FOTO_TAGE} Tagen gelöscht.</p>;
  return <>
    <div className="fotos">{imgs.map((f,i) => <div className="th" key={i}><img src={f} alt={`Foto ${i+1}`} onClick={() => setBig(f)} /></div>)}</div>
    <p className="muted small" style={{marginTop:6}}>Gespeichert bis {dDay(p.t + CONFIG.FOTO_TAGE*864e5)}</p>
    <Lightbox src={big} onClose={() => setBig(null)} />
  </>;
}

/* ---------- Verlauf-Analyse ---------- */
function analyse(list){
  const rows = list.map((p,i) => {
    const prev = list[i-1];
    const delta = prev ? r2(p.diff - prev.diff) : p.diff;
    let tag = null;
    if (!prev) { if (!isOk(p.diff)) tag = 'start'; }
    else if (isOk(prev.diff) && !isOk(p.diff)) tag = 'start';
    else if (!isOk(prev.diff) && isOk(p.diff)) tag = 'fixed';
    else if (!isOk(delta)) tag = 'change';
    return { p, delta, tag };
  });
  let origin = null, lastOk = null;
  const n = list.length - 1;
  if (n >= 0 && !isOk(list[n].diff)) {
    let i = n; while (i > 0 && !isOk(list[i-1].diff)) i--;
    origin = list[i]; lastOk = i > 0 ? list[i-1] : null;
  }
  return { rows, origin, lastOk };
}
const forKasse = (list, shopId, k) => list.filter(p => p.shop === shopId && p.kasse === k).sort((a,b) => a.t - b.t);

/* ---------- UI-Bausteine ---------- */
function Toast({ msg, onDone }){
  useEffect(() => { if (!msg) return; const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [msg]);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}
const SEGCOL = { 'Früh':'#B86E00', 'Abend':'#3A3F8F', 'Kasse 1':'#0D5C72', 'Kasse 2':'#8A3B8F' };
const Mark = ({ k }) => SEGCOL[k] ? <span style={{display:'inline-block',width:9,height:9,borderRadius:'50%',background:SEGCOL[k],marginRight:6,verticalAlign:'middle'}}></span> : null;
function Seg({ options, value, onChange }){
  return <div className="seg" role="tablist">{options.map(o =>
    <button key={o} className={o === value ? 'on' : ''} style={o === value && SEGCOL[o] ? {background:SEGCOL[o],color:'#fff'} : null}
      onClick={() => onChange(o)} role="tab" aria-selected={o === value}>{o !== value && <Mark k={o} />}{o}</button>)}</div>;
}
function Pill({ p }){
  if (!p) return <span className="pill none">Keine Zählung</span>;
  return isOk(p.diff) ? <span className="pill ok">Kasse OK</span> : <span className="pill bad">Nicht OK {eurS(p.diff)}</span>;
}
function StatusCard({ p, title }){
  if (!p) return <div className="status"><p className="muted">{title ? title + ': ' : ''}Noch keine Zählung vorhanden.</p></div>;
  const ok = isOk(p.diff);
  return (
    <div className={'status ' + (ok ? 'ok' : 'bad')}>
      <div className="muted small">{title ? title + ' · ' : ''}Letzte Zählung {p.schicht} · {dt(p.t)} · {p.name}{p.source === 'besuch' ? ' (Besuch)' : ''}</div>
      <div className="big">{ok ? 'Kasse OK' : 'Kasse nicht OK – nachzählen'}</div>
      <div className="kv num">
        <div><span>Soll</span><b>{eur(p.soll)}</b></div>
        <div><span>Ist</span><b>{eur(p.ist)}</b></div>
        <div><span>Differenz</span><b style={{color: ok ? 'var(--ok)' : 'var(--bad)'}}>{eurS(p.diff)}</b></div>
      </div>
      {p.bemerkung && <div className="note">Bemerkung: {p.bemerkung}</div>}
    </div>
  );
}
function CountRow({ it, value, onChange }){
  const n = parseCount(value);
  const set = v => onChange(String(v).replace(/[^0-9+-]/g,''));
  return (
    <div className={'row' + (n ? ' has' : '')}>
      <div className="lab num">{it.label}{it.hint && <small>{it.hint}</small>}</div>
      <div className="stepper">
        <button type="button" tabIndex={-1} aria-label={`${it.label} minus`} onClick={() => set(Math.max(0, n-1) || '')}>−</button>
        <input inputMode="numeric" value={value} placeholder="0" aria-label={`${it.label} Anzahl`}
          onChange={e => { const v = e.target.value; set(/^[+-]\d*$/.test(v) && value && !/^[+-]/.test(value) ? value + v : v); }}
          onBlur={() => set(parseCount(value) || '')}
          onFocus={e => e.target.select()} />
        <button type="button" tabIndex={-1} aria-label={`${it.label} plus`} onClick={() => set(n+1)}>+</button>
      </div>
      <div className="sum num">{eur(it.unit * n)}</div>
    </div>
  );
}

function CountForm({ shop, kasse, mode, prefill, takeover, onSave, onCancel }){
  const visit = mode === 'visit';
  const [schicht, setSchicht] = useState(visit ? 'Besuch' : (new Date().getHours() < CONFIG.FRUEH_BIS_STUNDE ? 'Früh' : 'Abend'));
  const [name, setName] = useState(() => visit ? ls.get('kzp_admin_name','Diego da Silva') : ls.get('kzp_name_' + shop.id, ''));
  const [soll, setSoll] = useState(prefill ? toIn(prefill.soll) : '');
  const [open, setOpen] = useState(prefill && prefill.open ? toIn(prefill.open) : '');
  const [counts, setCounts] = useState(prefill && takeover ? countsToStr(prefill.counts) : emptyCounts());
  const [bem, setBem] = useState('');
  const [fotos, setFotos] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const tt = useMemo(() => totals(counts), [counts]);
  const hasSoll = soll.trim() !== '';
  const diff = r2(tt.ist - parseEuro(soll) + parseEuro(open));
  const ok = isOk(diff);
  const state = !hasSoll ? 'idle' : ok ? 'ok' : 'bad';
  const setC = (g,i,v) => setCounts(c => ({ ...c, [g]: c[g].map((x,j) => j === i ? v : x) }));

  function submit(){
    setErr('');
    if (!hasSoll) return setErr('Soll-Betrag aus dem Kassensystem eintragen.');
    if (!name.trim()) return setErr('Namen eintragen.');
    if (!ok && !bem.trim()) return setErr('Differenz vorhanden – bitte Bemerkung eintragen.');
    const p = makeProtocol({ shop:shop.id, kasse, t:Date.now(), schicht, soll, open, counts, bemerkung:bem.trim(), name:name.trim(),
      source: visit ? 'besuch' : 'shop', fotos:fotos.length });
    ls.set(visit ? 'kzp_admin_name' : 'kzp_name_' + shop.id, name.trim());
    setBusy(true);
    saveProtocol(p, fotos).catch(e => alert('Speichern fehlgeschlagen: ' + (e.code === 'permission-denied' ? 'keine Berechtigung' : e.message)));
    onSave(p);
  }

  return (
    <div className="layout">
      <div>
        <div className="card">
          {!visit && <Seg options={['Früh','Abend']} value={schicht} onChange={setSchicht} />}
          {visit && takeover && prefill && <p className="note" style={{marginTop:0,marginBottom:12}}>Ist-Bestand aus Zählung {prefill.schicht} {dt(prefill.t)} ({prefill.name}) übernommen. Soll prüfen, bei Bedarf anpassen.</p>}
          <div className="grid2">
            <label className="field"><span>Gezählt von</span>
              <input className="inp" value={name} onChange={e => setName(e.target.value)} placeholder="Vor- und Nachname" autoComplete="name" /></label>
            <label className="field"><span>Soll laut Kassensystem</span>
              <input className="inp money" inputMode="decimal" value={soll} onChange={e => setSoll(e.target.value)} placeholder="0,00" /></label>
          </div>
          <label className="field" style={{marginBottom:0}}><span>Bereits bekannter Fehlbetrag (optional)</span>
            <input className="inp money" inputMode="decimal" value={open} onChange={e => setOpen(e.target.value)} placeholder="0,00" /></label>
        </div>
        <div className="groups">
          {GROUPS.map(g => (
            <section className="card" key={g.key}>
              <div className="ghead"><h3>{g.title}</h3><span className="num">{eur(tt[g.key])}</span></div>
              {g.items.map((it,i) => <CountRow key={i} it={it} value={counts[g.key][i]} onChange={v => setC(g.key,i,v)} />)}
            </section>
          ))}
        </div>
        <div className="card" style={{marginTop:12,marginBottom:0}}>
          <label className="field" style={{marginBottom:0}}>
            <span>Bemerkung{state === 'bad' ? ' (Pflicht bei Differenz)' : ''}</span>
            <textarea className={'inp' + (state === 'bad' && !bem.trim() ? ' req' : '')} value={bem} onChange={e => setBem(e.target.value)}
              placeholder={state === 'bad' ? 'Was ist bekannt? z. B. Wechselgeld falsch herausgegeben, Storno …' : 'Optional'} />
          </label>
        </div>
        <FotoInput fotos={fotos} setFotos={setFotos} />
        {onCancel && <button className="btn ghost" onClick={onCancel}>Abbrechen</button>}
      </div>
      <aside className={'tally ' + state} aria-live="polite">
        <div className="tnums num">
          <div><span>Soll</span><b>{hasSoll ? eur(parseEuro(soll)) : '–'}</b></div>
          <div><span>Ist</span><b>{eur(tt.ist)}</b></div>
          <div><span>Differenz</span><b>{hasSoll ? eurS(diff) : '–'}</b></div>
        </div>
        <div className="verdict">
          <span>{!hasSoll ? 'Soll eintragen' : ok ? 'Kasse stimmt' : 'Kasse stimmt nicht'}</span>
          <span className="num" style={SEGCOL[kasse] ? {background:SEGCOL[kasse],padding:'2px 8px',borderRadius:6} : null}>{kasse}</span>
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy} onClick={submit}>{visit ? 'Zählung speichern' : 'Protokoll speichern & senden'}</button>
        <div className="sub2">Tipp: im Feld „+3“ oder „-2“ tippen – wird zum vorhandenen Wert gerechnet.</div>
      </aside>
    </div>
  );
}

function HistItem({ p, tag, delta, isOrigin }){
  const [open, setOpen] = useState(false);
  const ok = isOk(p.diff);
  const multi = shopById(p.shop).kassen.length > 1;
  return (
    <li className={(ok ? '' : 'bad') + (isOrigin ? ' start' : '')}>
      <details onToggle={e => setOpen(e.currentTarget.open)}>
        <summary>
          <div><div className="when"><Mark k={p.schicht} />{p.schicht} · {dt(p.t)}{multi ? <> · <Mark k={p.kasse} />{p.kasse}</> : null}</div>
            <div className="who">{p.name} · Soll {eur(p.soll)} · Ist {eur(p.ist)}</div></div>
          <div className="d num">{eurS(p.diff)}</div>
          {(tag || p.source === 'besuch' || p.fotos > 0 || p._pending) && <div className="tags">
            {tag === 'start'  && <span className="tag red">Differenz entstanden</span>}
            {tag === 'change' && <span className="tag red">Abweichung verändert {eurS(delta)}</span>}
            {tag === 'fixed'  && <span className="tag green">Differenz behoben</span>}
            {p.source === 'besuch' && <span className="tag amber">Besuch</span>}
            {p.fotos > 0 && <span className="tag">📷 {p.fotos}</span>}
            {p._pending && <span className="tag amber">noch nicht übertragen</span>}
          </div>}
          {p.bemerkung && <div className="rem">„{p.bemerkung}“</div>}
        </summary>
        {open && <div className="body">
          <table className="num"><tbody>
            {GROUPS.map(g => g.items.map((it,i) => p.counts[g.key][i] > 0 &&
              <tr key={g.key+i}><td>{g.title}: {it.label}</td><td>× {p.counts[g.key][i]}</td><td>{eur(it.unit * p.counts[g.key][i])}</td></tr>))}
            {p.open ? <tr><td>Bekannter Fehlbetrag</td><td></td><td>{eur(p.open)}</td></tr> : null}
          </tbody></table>
          {p.fotos > 0 && <div style={{marginTop:10}}><FotoView p={p} /></div>}
        </div>}
      </details>
    </li>
  );
}
function History({ list }){
  const { rows, origin, lastOk } = useMemo(() => analyse(list), [list]);
  if (!list.length) return <div className="empty">Noch keine Zählungen für diese Kasse.</div>;
  return (
    <div>
      {origin && (
        <div className="origin">
          <b>Differenz seit {origin.schicht} {dt(origin.t)}</b> ({origin.name}).<br/>
          {lastOk ? <>Letzte stimmige Zählung: {lastOk.schicht} {dt(lastOk.t)} ({lastOk.name}). Die Differenz ist dazwischen entstanden.</> : 'Keine stimmige Zählung davor vorhanden.'}
        </div>
      )}
      <ol className="tl">
        {rows.slice().reverse().slice(0, 120).map(({ p, delta, tag }) =>
          <HistItem key={p.id} p={p} tag={tag} delta={delta} isOrigin={origin && origin.id === p.id} />)}
      </ol>
    </div>
  );
}
function MailBox({ p }){
  const m = buildMail(p); const [c, setC] = useState(false);
  return (
    <div>
      <div className="btns">
        <a className="btn" style={{textAlign:'center',textDecoration:'none'}} href={m.href} target="_blank" rel="noopener">E-Mail öffnen</a>
        <button className="btn ghost" onClick={() => copyText(`Betreff: ${m.subject}\n\n${m.body}`, () => setC(true))}>{c ? 'Kopiert' : 'Mailtext kopieren'}</button>
      </div>
      <details style={{marginTop:10}}><summary className="small muted" style={{cursor:'pointer'}}>Mail-Vorschau</summary>
        <pre className="small" style={{whiteSpace:'pre-wrap',background:'var(--soft)',padding:10,borderRadius:8,marginTop:8}}>{'An: ' + CONFIG.MAIL_TO + '\nBetreff: ' + m.subject + '\n\n' + m.body}</pre>
      </details>
    </div>
  );
}
function Foot({ admin }){
  return <div className="foot">Kassenzählprotokoll v{APP_VERSION}{admin && auth.currentUser ? ' · ' + auth.currentUser.email : ''}
    {admin && <><br/><button onClick={() => { if (confirm('Abmelden?')) auth.signOut(); }}>Abmelden</button></>}</div>;
}

/* ---------- Shop ---------- */
function ShopApp({ shop }){
  const { list, loading, error } = useProtocols([shop.id]);
  const [kasse, setKasse] = useState(shop.kassen[0]);
  const [tab, setTab] = useState('count');
  const [sent, setSent] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const mine = forKasse(list, shop.id, kasse);
  const last = mine[mine.length - 1];
  return (
    <>
      <header className="top">
        <div className="top-row"><div className="grow"><h1>{shop.name}</h1><div className="sub">Kassenzählprotokoll</div></div></div>
        <nav className="tabs">
          <button className={'tab' + (tab === 'count' ? ' on' : '')} onClick={() => setTab('count')}>Zählen</button>
          <button className={'tab' + (tab === 'hist' ? ' on' : '')} onClick={() => setTab('hist')}>Verlauf</button>
        </nav>
        <div className={'brand ' + shop.brand}></div>
      </header>
      <main className="wrap">
        {error && <div className="errbox">{error}</div>}
        {shop.kassen.length > 1 && <Seg options={shop.kassen} value={kasse} onChange={k => { setKasse(k); setSent(null); setFormKey(x => x+1); }} />}
        {tab === 'count' && (sent && sent.kasse === kasse ? (
          <div>
            <StatusCard p={sent} title={kasse} />
            <div className="card">
              <p><b>Protokoll gespeichert.</b> Jetzt E-Mail öffnen und dort auf <b>Senden</b> tippen.</p>
              {!navigator.onLine && <p className="note">Kein Internet – Protokoll wird automatisch übertragen, sobald wieder Verbindung besteht.</p>}
              <MailBox p={sent} />
              <button className="btn ghost" style={{marginTop:8}} onClick={() => { setSent(null); setFormKey(x => x+1); }}>Neues Protokoll</button>
            </div>
          </div>
        ) : (
          <>
            {loading ? <div className="status"><p className="muted">Lade letzte Zählung …</p></div> : last && <StatusCard p={last} title={kasse} />}
            <CountForm key={kasse + formKey} shop={shop} kasse={kasse} mode="shop" onSave={p => { setSent(p); window.scrollTo(0,0); }} />
          </>
        ))}
        {tab === 'hist' && (loading ? <div className="center">Lade Verlauf …</div> : <History list={mine} />)}
        <Foot />
      </main>
    </>
  );
}

/* ---------- Regionalleitung ---------- */
function Overview({ list, onOpen }){
  const now = Date.now(); const stats = { ok:0, bad:0, none:0 };
  SHOPS.forEach(s => s.kassen.forEach(k => { const l = forKasse(list, s.id, k).pop(); if (!l) stats.none++; else if (isOk(l.diff)) stats.ok++; else stats.bad++; }));
  return (
    <>
      <div className="summary num">
        <div className="bad"><b>{stats.bad}</b>Kasse nicht OK</div>
        <div className="ok"><b>{stats.ok}</b>Kasse OK</div>
        <div><b>{stats.none}</b>ohne Zählung</div>
      </div>
      <div className="sgrid">
        {SHOPS.map(s => {
          const lasts = s.kassen.map(k => forKasse(list, s.id, k).pop());
          const anyBad = lasts.some(l => l && !isOk(l.diff));
          return (
            <button key={s.id} className={'scard' + (anyBad ? ' bad' : '')} onClick={() => onOpen(s.id)}>
              <h3><span className={'dot ' + s.brand}></span>{s.name}</h3>
              {s.kassen.map((k,i) => {
                const today = list.filter(p => p.shop === s.id && p.kasse === k && sameDay(p.t, now));
                const l = lasts[i];
                return (
                  <div className="kline" key={k}>
                    <span style={{fontWeight:600}}>{s.kassen.length > 1 && <Mark k={k} />}{k}</span>
                    <Pill p={l} />
                    <span className="chips">
                      <span className={'chip' + (today.some(p => p.schicht === 'Früh') ? ' on' : '')}>Früh</span>
                      <span className={'chip' + (today.some(p => p.schicht === 'Abend') ? ' on' : '')}>Abend</span>
                    </span>
                    {l && <span className="muted small" style={{width:'100%'}}>{l.schicht} {dt(l.t)} · {l.name}</span>}
                  </div>
                );
              })}
            </button>
          );
        })}
      </div>
    </>
  );
}
function Visit({ shop, list, toast }){
  const [kasse, setKasse] = useState(shop.kassen[0]);
  const [form, setForm] = useState(null);
  const mine = forKasse(list, shop.id, kasse);
  const last = mine[mine.length - 1];
  if (form) return (
    <>
      <h2>{shop.name} – {kasse}: {form.empty ? 'Neu zählen' : 'Ist übernehmen'}</h2>
      <CountForm key={kasse + (form.empty ? 'n' : 'p')} shop={shop} kasse={kasse} mode="visit" prefill={last} takeover={!form.empty}
        onCancel={() => setForm(null)}
        onSave={p => { setForm(null); toast(isOk(p.diff) ? 'Gespeichert – Kasse OK' : 'Gespeichert – Kasse nicht OK'); window.scrollTo(0,0); }} />
    </>
  );
  return (
    <>
      {shop.kassen.length > 1 && <Seg options={shop.kassen} value={kasse} onChange={setKasse} />}
      <StatusCard p={last} title={kasse} />
      <div className="btns" style={{marginBottom:16}}>
        <button className="btn" disabled={!last} style={!last ? {opacity:.5} : null} onClick={() => setForm({ empty:false })}>Ist übernehmen</button>
        <button className="btn ghost" onClick={() => setForm({ empty:true })}>Neu zählen</button>
      </div>
      <h2>Verlauf</h2>
      <History list={mine} />
    </>
  );
}
function LinksTab({ toast }){
  return (
    <div className="card">
      <h2>Shop-Links</h2>
      <p className="muted small">Jeder Shop öffnet nur seinen Link und sieht nur seine eigenen Daten. Link öffnen → „Zum Home-Bildschirm“.</p>
      {SHOPS.map(s => { const u = `${ROOT}${s.id}/`; return (
        <div className="linkrow" key={s.id}><span className={'dot ' + s.brand}></span>
          <span style={{flex:1}}><b>{s.name}</b><br/><a className="small" href={u} style={{color:'var(--petrol)',wordBreak:'break-all'}}>{u}</a></span>
          <button className="btn ghost inline" onClick={() => copyText(u, () => toast('Link kopiert'))}>Link kopieren</button></div>); })}
    </div>
  );
}
function AdminApp({ openShop }){
  const { list, loading, error } = useProtocols(SHOPS.map(s => s.id));
  const [tab, setTab] = useState('shops');
  const [shopId, setShopId] = useState(openShop && shopById(openShop) ? openShop : null);
  const [msg, setMsg] = useState('');
  useEffect(() => { cleanupFotos(); }, []);
  useEffect(() => { if (openShop && shopById(openShop)) { setShopId(openShop); history.replaceState(null,'',ROOT); } }, [openShop]);
  const shop = shopId && shopById(shopId);
  return (
    <>
      <Toast msg={msg} onDone={() => setMsg('')} />
      <header className="top">
        <div className="top-row">
          {shop && <button className="back" onClick={() => setShopId(null)} aria-label="Zurück">‹ Shops</button>}
          <div className="grow"><h1>{shop ? shop.name : 'Kassenübersicht'}</h1><div className="sub">{shop ? 'Shopbesuch' : 'Regionalleitung'}</div></div>
        </div>
        {!shop && <nav className="tabs">
          {[['shops','Shops'],['links','Shop-Links']].map(([k,l]) =>
            <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}
        </nav>}
        <div className={'brand ' + (shop ? shop.brand : 'admin')} style={{marginTop: shop ? 12 : 0}}></div>
      </header>
      <main className="wrap">
        {error && <div className="errbox">{error}</div>}
        {loading && !list.length ? <div className="center">Lade Daten …</div> :
          shop ? <Visit key={shop.id} shop={shop} list={list} toast={setMsg} /> :
          tab === 'shops' ? <Overview list={list} onOpen={id => { setShopId(id); window.scrollTo(0,0); }} /> :
          <LinksTab toast={setMsg} />}
        <Foot admin />
      </main>
    </>
  );
}

/* ---------- Login (nur Regionalleitung) / Start ---------- */
function Login(){
  const [email, setEmail] = useState(CONFIG.ADMIN_EMAILS[0] || '');
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go(e){
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await auth.signInWithEmailAndPassword(email.trim(), pw);
      if (!isAdminUser(auth.currentUser)) { await auth.signOut(); setErr('Kein Zugang für diese E-Mail.'); }
    } catch(x){
      setErr(['auth/wrong-password','auth/invalid-credential','auth/invalid-login-credentials','auth/user-not-found'].includes(x.code) ? 'E-Mail oder Passwort falsch.' :
             x.code === 'auth/network-request-failed' ? 'Keine Internetverbindung.' :
             x.code === 'auth/too-many-requests' ? 'Zu viele Versuche – kurz warten.' : x.message);
    }
    setBusy(false);
  }
  return (
    <div className="login">
      <div className="brand admin" style={{margin:'0 0 16px',borderRadius:4}}></div>
      <h1>Regionalleitung</h1>
      <p className="muted">Kassenzählprotokoll – Anmeldung</p>
      <form className="card" onSubmit={go}>
        {err && <div className="errbox">{err}</div>}
        <label className="field"><span>E-Mail</span><input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" /></label>
        <label className="field"><span>Passwort</span><input className="inp" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" autoFocus /></label>
        <button className="btn" disabled={busy || !pw}>{busy ? 'Anmelden …' : 'Anmelden'}</button>
      </form>
    </div>
  );
}
function App(){
  const shop = PAGE_SHOP;
  const [user, setUser] = useState(undefined);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(hashOpen);
  useEffect(() => auth.onAuthStateChanged(u => setUser(u || null)), []);
  useEffect(() => { const f = () => setOpen(hashOpen()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  // Shops: ohne Passwort, anonyme Anmeldung im Hintergrund
  useEffect(() => {
    if (shop && user === null) auth.signInAnonymously().catch(e => setErr(e.code === 'auth/network-request-failed'
      ? 'Keine Internetverbindung – für den ersten Start wird Internet benötigt.' : 'Anmeldung fehlgeschlagen: ' + e.message));
  }, [shop, user]);

  if (shop) {
    if (err && !user) return <div className="center"><div className="errbox">{err}</div><button className="btn inline" onClick={() => location.reload()}>Erneut versuchen</button></div>;
    if (!user) return <div className="center">Lade …</div>;
    return <ShopApp shop={shop} />;
  }
  if (user === undefined) return <div className="center">Lade …</div>;
  if (isAdminUser(user)) return <AdminApp openShop={open} />;
  return <Login />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register(ROOT + 'sw.js', { scope: ROOT }).catch(() => {});
