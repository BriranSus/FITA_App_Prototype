import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Camera, Upload, ChevronRight, ChevronLeft, User, Home, History,
  ScanLine, Sparkles, Check, AlertCircle, Info, ArrowRight,
} from "lucide-react";

// ===========================================================================
// DESAIN TOKEN — konsisten dengan prototype optimizer sebelumnya
// ===========================================================================
const INK = "#1E2B25";
const TEAL = "#3B6357";
const ACCENT = "#C97B2E";
const PAPER = "#F6F2EA";
const DANGER = "#A34A3E";
const OK = "#3F7A57";
const LINE = "#E4DCCB";

// ===========================================================================
// DATA — TKPI-like nutrient table (per 100g), AKG ilustratif per kelompok umur
// CATATAN: nilai AKG di bawah ILUSTRATIF untuk demo alur UI. Ganti dengan
// tabel resmi Permenkes No.28/2019 Lampiran sebelum dipakai di sistem final.
// ===========================================================================
const TKPI = {
  "Ayam goreng": { fe: 1.2, zn: 1.8, vitc: 0, protein: 25, kcal: 260, per: 100 },
  "Tempe goreng": { fe: 2.5, zn: 1.5, vitc: 0, protein: 15, kcal: 195, per: 100 },
  "Tumis kangkung": { fe: 2.0, zn: 0.4, vitc: 18, protein: 2.6, kcal: 45, per: 100 },
};

const AKG_TABLE = {
  "1-3 tahun": { energy: 1350, protein: 20, fe: 7, zn: 3, vitc: 40 },
  "4-6 tahun": { energy: 1400, protein: 25, fe: 10, zn: 5, vitc: 45 },
  "7-9 tahun": { energy: 1650, protein: 40, fe: 10, zn: 5, vitc: 45 },
};

function ageToBracket(years) {
  if (years <= 3) return "1-3 tahun";
  if (years <= 6) return "4-6 tahun";
  return "7-9 tahun";
}

// Mock hasil deteksi YOLOv8 (koordinat bounding box relatif 0-1 terhadap gambar)
const MOCK_DETECTIONS = [
  { id: 1, label: "Ayam goreng", confidence: 0.94, gram: 65, box: { x: 0.10, y: 0.12, w: 0.34, h: 0.30 }, color: "#C97B2E" },
  { id: 2, label: "Tempe goreng", confidence: 0.89, gram: 40, box: { x: 0.52, y: 0.10, w: 0.30, h: 0.24 }, color: "#3B6357" },
  { id: 3, label: "Tumis kangkung", confidence: 0.91, gram: 55, box: { x: 0.14, y: 0.50, w: 0.66, h: 0.34 }, color: "#5B7C43" },
];

// ===========================================================================
// KNOWLEDGE BASE REKOMENDASI — sama dengan prototype optimizer sebelumnya
// ===========================================================================
const FOODS = [
  { id: "hati", name: "Hati ayam", cost: 4000, fe: 9.0, zn: 2.7, vitc: 0, protein: 17, heme: true, phytate: false, calcium: false },
  { id: "jambu", name: "Jambu biji", cost: 3000, fe: 0.3, zn: 0.2, vitc: 87, protein: 1, heme: false, phytate: false, calcium: false },
  { id: "kachijau", name: "Kacang hijau", cost: 2500, fe: 3.0, zn: 1.8, vitc: 0, protein: 7, heme: false, phytate: true, calcium: false },
  { id: "teri", name: "Ikan teri", cost: 3500, fe: 3.9, zn: 1.2, vitc: 0, protein: 12, heme: true, phytate: false, calcium: false },
  { id: "jeruk", name: "Jeruk", cost: 2000, fe: 0.1, zn: 0.1, vitc: 53, protein: 1, heme: false, phytate: false, calcium: false },
  { id: "bayam", name: "Bayam", cost: 1500, fe: 3.5, zn: 0.5, vitc: 28, protein: 2.9, heme: false, phytate: false, calcium: false },
  { id: "tahu", name: "Tahu", cost: 1500, fe: 1.5, zn: 0.8, vitc: 0, protein: 8, heme: false, phytate: true, calcium: false },
];
const WEIGHTS = { fe: 1.5, zn: 1.5, vitc: 0.5, protein: 1.0 };

function contributionOf(comboIds) {
  const combo = FOODS.filter((f) => comboIds.includes(f.id));
  const vitcTotal = combo.reduce((s, f) => s + f.vitc, 0);
  const hasPhytate = combo.some((f) => f.phytate);
  const hasHeme = combo.some((f) => f.heme);
  const feRaw = combo.reduce((s, f) => s + f.fe, 0);
  const znRaw = combo.reduce((s, f) => s + f.zn, 0);
  let feFactor = 1.0;
  if (vitcTotal >= 25) feFactor *= 2.0;
  if (hasPhytate && !hasHeme) feFactor *= 0.6;
  let znFactor = hasPhytate ? 0.7 : 1.0;
  return {
    fe: +(feRaw * feFactor).toFixed(1),
    zn: +(znRaw * znFactor).toFixed(1),
    vitc: +vitcTotal.toFixed(1),
    protein: +combo.reduce((s, f) => s + f.protein, 0).toFixed(1),
    cost: combo.reduce((s, f) => s + f.cost, 0),
    feFactor, znFactor,
  };
}
function combos(arr, k) {
  const res = [];
  (function h(start, c) {
    if (c.length === k) { res.push([...c]); return; }
    for (let i = start; i < arr.length; i++) { c.push(arr[i]); h(i + 1, c); c.pop(); }
  })(0, []);
  return res;
}
function bestCombo(gap, budget = 12000, maxItems = 2) {
  const ids = FOODS.map((f) => f.id);
  let all = [];
  for (let k = 1; k <= maxItems; k++) {
    for (const c of combos(ids, k)) {
      const contrib = contributionOf(c);
      if (contrib.cost > budget) continue;
      const score = Object.keys(WEIGHTS).reduce(
        (t, n) => t + WEIGHTS[n] * Math.max(0, gap[n] - contrib[n]), 0
      );
      all.push({ ids: c, contrib, score });
    }
  }
  all.sort((a, b) => a.score - b.score || a.contrib.cost - b.contrib.cost);
  return all[0];
}

// ===========================================================================
// SHARED UI PRIMITIVES
// ===========================================================================
function AppBar({ title, step, totalSteps }) {
  return (
    <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${LINE}`, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={14} color="#fff" />
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: INK }}>FITA</span>
        <span style={{ fontSize: 11, color: "#8A8272", marginLeft: "auto" }}>Langkah {step}/{totalSteps}</span>
      </div>
      <h2 style={{ fontSize: 17, margin: "10px 0 0", color: INK }}>{title}</h2>
      <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? ACCENT : LINE }} />
        ))}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: disabled ? "#D8D0C0" : ACCENT, color: "#fff", border: "none",
        padding: "13px 16px", borderRadius: 8, fontSize: 14.5, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children} {Icon && <Icon size={16} />}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, ...style }}>
      {children}
    </div>
  );
}

// ===========================================================================
// STEP 1 — PROFIL ANAK
// ===========================================================================
function ProfileStep({ profile, setProfile, onNext }) {
  const ready = profile.name && profile.age && profile.weight && profile.height;
  return (
    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12.5, color: "#5A5347", margin: 0, lineHeight: 1.5 }}>
        Data ini dipakai untuk hitung Angka Kecukupan Gizi (AKG) personal anak — jadi acuan
        target di analisis gizi nanti.
      </p>
      <Field label="Nama anak" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} placeholder="mis. Nadia" />
      <Field label="Umur (tahun)" value={profile.age} onChange={(v) => setProfile({ ...profile, age: v })} placeholder="mis. 4" type="number" />
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Berat (kg)" value={profile.weight} onChange={(v) => setProfile({ ...profile, weight: v })} placeholder="14.5" type="number" />
        <Field label="Tinggi (cm)" value={profile.height} onChange={(v) => setProfile({ ...profile, height: v })} placeholder="98" type="number" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {["Laki-laki", "Perempuan"].map((g) => (
          <button
            key={g}
            onClick={() => setProfile({ ...profile, gender: g })}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 7, fontSize: 13,
              border: profile.gender === g ? `2px solid ${TEAL}` : `1px solid ${LINE}`,
              background: profile.gender === g ? "#EAF1EC" : "#fff",
              color: INK, cursor: "pointer", fontWeight: profile.gender === g ? 600 : 400,
            }}
          >
            {g}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <PrimaryButton onClick={onNext} disabled={!ready} icon={ChevronRight}>Lanjut ke Scan</PrimaryButton>
    </div>
  );
}
function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label style={{ flex: 1, display: "block" }}>
      <div style={{ fontSize: 11.5, color: "#8A8272", marginBottom: 4 }}>{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 11px", borderRadius: 7,
          border: `1px solid ${LINE}`, fontSize: 14, outline: "none", color: INK,
        }}
      />
    </label>
  );
}

// ===========================================================================
// STEP 2 — SCAN MAKANAN
// ===========================================================================
function ScanStep({ onNext, scanned, setScanned }) {
  return (
    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12.5, color: "#5A5347", margin: 0, lineHeight: 1.5 }}>
        Foto piring makan anak. Pastikan seluruh piring kelihatan di frame — sistem pakai ukuran
        piring sebagai referensi estimasi porsi.
      </p>
      <div
        onClick={() => setScanned(true)}
        style={{
          aspectRatio: "1", borderRadius: 12, border: `2px dashed ${scanned ? TEAL : "#C9BFA8"}`,
          background: scanned ? "#fff" : "#EFEAE0", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden",
        }}
      >
        {scanned ? <PlateIllustration /> : (
          <div style={{ textAlign: "center", color: "#8A8272" }}>
            <Camera size={30} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 12.5 }}>Ketuk untuk ambil foto</div>
          </div>
        )}
      </div>
      {!scanned ? (
        <div style={{ display: "flex", gap: 8 }}>
          <SecondaryButton icon={Camera} label="Kamera" onClick={() => setScanned(true)} />
          <SecondaryButton icon={Upload} label="Galeri" onClick={() => setScanned(true)} />
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "#8A8272", display: "flex", gap: 5, alignItems: "center" }}>
          <Info size={12} /> Foto contoh (mock) — nanti diganti input foto asli dari kamera device.
        </div>
      )}
      <div style={{ flex: 1 }} />
      <PrimaryButton onClick={onNext} disabled={!scanned} icon={ScanLine}>Deteksi lauk pauk</PrimaryButton>
    </div>
  );
}
function SecondaryButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "11px 0", borderRadius: 8, border: `1px solid ${LINE}`, background: "#fff",
      fontSize: 13, color: INK, cursor: "pointer",
    }}>
      <Icon size={15} /> {label}
    </button>
  );
}
function PlateIllustration({ showBoxes = false, detections = [] }) {
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%">
      <circle cx="150" cy="150" r="140" fill="#F0EBE0" stroke="#D8D0C0" strokeWidth="2" />
      <circle cx="150" cy="150" r="118" fill="#FCFAF5" />
      {/* ayam goreng */}
      <ellipse cx="95" cy="105" rx="42" ry="30" fill="#C97B2E" opacity="0.85" transform="rotate(-15 95 105)" />
      <ellipse cx="115" cy="120" rx="26" ry="18" fill="#B5691F" opacity="0.85" />
      {/* tempe goreng */}
      <rect x="185" y="70" rx="4" width="70" height="45" fill="#D9B36C" opacity="0.9" transform="rotate(8 220 92)" />
      <rect x="190" y="95" rx="4" width="55" height="30" fill="#C79E52" opacity="0.9" transform="rotate(-4 217 110)" />
      {/* tumis kangkung */}
      <path d="M60 190 Q100 165 150 185 Q200 205 240 185 Q235 225 190 235 Q120 250 75 225 Q55 210 60 190 Z" fill="#5B7C43" opacity="0.85" />
      {showBoxes && detections.map((d) => (
        <g key={d.id}>
          <rect
            x={d.box.x * 300} y={d.box.y * 300} width={d.box.w * 300} height={d.box.h * 300}
            fill="none" stroke={d.color} strokeWidth="2.5" strokeDasharray="6 3" rx="4"
          />
          <rect x={d.box.x * 300} y={d.box.y * 300 - 16} width={Math.max(d.label.length * 6.2 + 14, 60)} height="16" fill={d.color} rx="3" />
          <text x={d.box.x * 300 + 5} y={d.box.y * 300 - 4} fontSize="9.5" fill="#fff" fontWeight="600">
            {d.label} {Math.round(d.confidence * 100)}%
          </text>
        </g>
      ))}
    </svg>
  );
}

// ===========================================================================
// STEP 3 — HASIL DETEKSI
// ===========================================================================
function DetectionStep({ onNext }) {
  return (
    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${LINE}` }}>
        <PlateIllustration showBoxes detections={MOCK_DETECTIONS} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8272" }}>
        <Info size={12} /> Bounding box &amp; confidence simulasi — output asli dari model YOLOv8 fine-tuned.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MOCK_DETECTIONS.map((d) => (
          <Card key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{d.label}</div>
              <div style={{ fontSize: 11, color: "#8A8272" }}>Estimasi porsi: {d.gram}g (known-plate-size)</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{Math.round(d.confidence * 100)}%</div>
          </Card>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <PrimaryButton onClick={onNext} icon={ChevronRight}>Lihat analisis gizi</PrimaryButton>
    </div>
  );
}

// ===========================================================================
// STEP 4 — ANALISIS GIZI (gap vs AKG)
// ===========================================================================
function NutritionStep({ profile, onNext, gap, intake, target }) {
  const chartData = ["fe", "zn", "vitc", "protein"].map((n) => ({
    nama: { fe: "Fe", zn: "Zn", vitc: "VitC", protein: "Protein" }[n],
    asupan: intake[n],
    target: target[n],
    tercukupi: intake[n] >= target[n],
  }));
  return (
    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ background: "#FBF6ED" }}>
        <div style={{ fontSize: 12, color: "#8A8272" }}>Bracket AKG</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{ageToBracket(Number(profile.age) || 4)} &middot; {profile.gender}</div>
      </Card>
      <div style={{ fontSize: 12.5, color: "#5A5347" }}>Asupan dari foto ini vs target AKG harian:</div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={LINE} />
          <XAxis dataKey="nama" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
          <Bar dataKey="asupan" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => <Cell key={i} fill={d.tercukupi ? OK : DANGER} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {chartData.map((d) => (
          <div key={d.nama} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            {d.tercukupi ? <Check size={14} color={OK} /> : <AlertCircle size={14} color={DANGER} />}
            <span style={{ color: INK }}>{d.nama}: {d.asupan} dari target {d.target}</span>
            {!d.tercukupi && <span style={{ color: DANGER, marginLeft: "auto", fontWeight: 600 }}>-{(d.target - d.asupan).toFixed(1)}</span>}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <PrimaryButton onClick={onNext} icon={Sparkles}>Cari rekomendasi</PrimaryButton>
    </div>
  );
}

// ===========================================================================
// STEP 5 — REKOMENDASI
// ===========================================================================
function RecommendationStep({ gap }) {
  const rec = useMemo(() => bestCombo(gap), [gap]);
  if (!rec) return <div style={{ padding: 18 }}>Tidak ada rekomendasi dalam batasan.</div>;
  const names = rec.ids.map((id) => FOODS.find((f) => f.id === id).name);
  return (
    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ background: TEAL, color: "#fff", border: "none" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>Rekomendasi pangan komplementer</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{names.join(" + ")}</div>
        <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 4 }}>
          Rp{rec.contrib.cost.toLocaleString("id-ID")} &middot; menutup {Object.keys(WEIGHTS).filter(n => rec.contrib[n] >= gap[n]).length}/4 gap nutrien
        </div>
      </Card>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginTop: 2 }}>Kenapa kombinasi ini?</div>
      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ReasonRow icon={Sparkles} color={ACCENT} text={`Faktor serapan zat besi ×${rec.contrib.feFactor.toFixed(1)} — vitamin C dalam kombinasi cukup untuk boost non-heme iron.`} />
        <ReasonRow icon={Check} color={OK} text="Menutup gap protein & zat besi sekaligus dalam satu rekomendasi (bukan rule terpisah per-nutrien)." />
        <ReasonRow icon={Info} color={TEAL} text="Bahan pangan lokal, terjangkau, umum tersedia di pasar tradisional." />
      </Card>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginTop: 2 }}>Alternatif lain</div>
      <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, color: "#8A8272" }}>Ikan teri + Jeruk &middot; Rp5.500</div>
        <div style={{ fontSize: 12, color: "#8A8272" }}>Kacang hijau + Bayam &middot; Rp4.000</div>
      </Card>
      <div style={{ flex: 1 }} />
      <PrimaryButton onClick={() => {}} icon={ArrowRight}>Simpan ke riwayat</PrimaryButton>
    </div>
  );
}
function ReasonRow({ icon: Icon, color, text }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Icon size={14} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: "#4A453A", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

// ===========================================================================
// BOTTOM NAV (dekorasi — nunjukin ini bagian dari app yang lebih besar)
// ===========================================================================
function BottomNav() {
  const items = [
    { icon: Home, label: "Beranda" },
    { icon: ScanLine, label: "Scan", active: true },
    { icon: History, label: "Riwayat" },
    { icon: User, label: "Profil" },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${LINE}`, background: "#fff", padding: "8px 0 10px" }}>
      {items.map((it) => (
        <div key={it.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: it.active ? ACCENT : "#B0A891" }}>
          <it.icon size={18} />
          <span style={{ fontSize: 9.5 }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// MAIN APP — wizard step controller di dalam phone frame
// ===========================================================================
const STEP_TITLES = ["Profil Anak", "Scan Makanan", "Hasil Deteksi", "Analisis Gizi", "Rekomendasi"];

export default function FitaAppPrototype() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({ name: "", age: "4", weight: "14.5", height: "98", gender: "Perempuan" });
  const [scanned, setScanned] = useState(false);

  const target = AKG_TABLE[ageToBracket(Number(profile.age) || 4)];
  const intake = useMemo(() => {
    const totals = { fe: 0, zn: 0, vitc: 0, protein: 0 };
    MOCK_DETECTIONS.forEach((d) => {
      const t = TKPI[d.label];
      const ratio = d.gram / t.per;
      totals.fe += t.fe * ratio;
      totals.zn += t.zn * ratio;
      totals.vitc += t.vitc * ratio;
      totals.protein += t.protein * ratio;
    });
    return { fe: +totals.fe.toFixed(1), zn: +totals.zn.toFixed(1), vitc: +totals.vitc.toFixed(1), protein: +totals.protein.toFixed(1) };
  }, []);
  const gap = {
    fe: Math.max(0, target.fe - intake.fe),
    zn: Math.max(0, target.zn - intake.zn),
    vitc: Math.max(0, target.vitc - intake.vitc),
    protein: Math.max(0, target.protein - intake.protein),
  };

  return (
    <div style={{ background: "#DED5C0", minHeight: "100%", display: "flex", justifyContent: "center", padding: "24px 12px", fontFamily: "'Inter', system-ui, sans-serif", boxSizing: "border-box" }}>
      <div style={{
        width: 380, background: PAPER, borderRadius: 26, overflow: "hidden",
        boxShadow: "0 20px 50px rgba(30,43,37,0.25)", border: `6px solid ${INK}`,
        display: "flex", flexDirection: "column", minHeight: 720,
      }}>
        <AppBar title={STEP_TITLES[step - 1]} step={step} totalSteps={5} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {step === 1 && <ProfileStep profile={profile} setProfile={setProfile} onNext={() => setStep(2)} />}
          {step === 2 && <ScanStep scanned={scanned} setScanned={setScanned} onNext={() => setStep(3)} />}
          {step === 3 && <DetectionStep onNext={() => setStep(4)} />}
          {step === 4 && <NutritionStep profile={profile} gap={gap} intake={intake} target={target} onNext={() => setStep(5)} />}
          {step === 5 && <RecommendationStep gap={gap} />}
        </div>

        {step > 1 && (
          <div style={{ padding: "0 18px 8px", display: "flex" }}>
            <button onClick={() => setStep(step - 1)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#8A8272", fontSize: 12, cursor: "pointer", padding: "6px 0" }}>
              <ChevronLeft size={14} /> Kembali
            </button>
          </div>
        )}
        <BottomNav />
      </div>
    </div>
  );
}
