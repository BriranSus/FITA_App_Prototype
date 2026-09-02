import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Camera, Upload, ChevronRight, ChevronLeft, User, Home, History,
  ScanLine, Sparkles, Check, AlertCircle, Info, ArrowRight, RotateCcw,
  Utensils, BookOpen, HeartPulse,
} from "lucide-react";

// ===========================================================================
// DESAIN TOKEN — Konsisten dengan prototype awal
// ===========================================================================
const INK = "#1E2B25";
const TEAL = "#3B6357";
const ACCENT = "#C97B2E";
const PAPER = "#F6F2EA";
const DANGER = "#A34A3E";
const OK = "#3F7A57";
const LINE = "#E4DCCB";

// ===========================================================================
// DATA — TKPI-like nutrient table (per 100g) & AKG Permenkes No.28/2019
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
  const y = Number(years) || 4;
  if (y <= 3) return "1-3 tahun";
  if (y <= 6) return "4-6 tahun";
  return "7-9 tahun";
}

const MOCK_DETECTIONS = [
  { id: 1, label: "Ayam goreng", confidence: 0.94, gram: 65, box: { x: 0.10, y: 0.12, w: 0.34, h: 0.30 }, color: "#C97B2E" },
  { id: 2, label: "Tempe goreng", confidence: 0.89, gram: 40, box: { x: 0.52, y: 0.10, w: 0.30, h: 0.24 }, color: "#3B6357" },
  { id: 3, label: "Tumis kangkung", confidence: 0.91, gram: 55, box: { x: 0.14, y: 0.50, w: 0.66, h: 0.34 }, color: "#5B7C43" },
];

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

const STEP_TITLES = ["Profil Anak", "Scan Makanan", "Hasil Deteksi", "Analisis Gizi", "Rekomendasi"];

const STEPS_DATA = [
  { id: 1, title: "Profil Anak", subtitle: "Identitas & target AKG personal", icon: User },
  { id: 2, title: "Scan Makanan", subtitle: "Foto piring makan beracuan", icon: Camera },
  { id: 3, title: "Hasil Deteksi", subtitle: "Deteksi YOLOv8 & estimasi porsi", icon: ScanLine },
  { id: 4, title: "Analisis Gizi", subtitle: "Komparasi asupan vs target AKG", icon: HeartPulse },
  { id: 5, title: "Rekomendasi", subtitle: "Optimasi pangan komplementer", icon: Sparkles },
];

// ===========================================================================
// PLATE ILLUSTRATION (SVG ASLI)
// ===========================================================================
function PlateIllustration({ showBoxes = false, detections = [] }) {
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" className="block">
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
// 100% KOMPONEN ASLI AWAL (UNTUK VIEW HP — SEAMLESS TANPA BORDER)
// ===========================================================================
function MobileAppBar({ title, step, totalSteps }) {
  return (
    <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${LINE}`, background: "#fff", position: "sticky", top: 0, zIndex: 20 }}>
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

function MobilePrimaryButton({ children, onClick, disabled, icon: Icon }) {
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

function MobileSecondaryButton({ icon: Icon, label, onClick }) {
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

function MobileCard({ children, style }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, ...style }}>
      {children}
    </div>
  );
}

function MobileField({ label, value, onChange, placeholder, type = "text" }) {
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
          background: "#fff",
        }}
      />
    </label>
  );
}

function MobileProfileStep({ profile, setProfile, onNext }) {
  const ready = profile.name && profile.age && profile.weight && profile.height;
  return (
    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12.5, color: "#5A5347", margin: 0, lineHeight: 1.5 }}>
        Data ini dipakai untuk hitung Angka Kecukupan Gizi (AKG) personal anak — jadi acuan
        target di analisis gizi nanti.
      </p>
      <MobileField label="Nama anak" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} placeholder="mis. Nadia" />
      <MobileField label="Umur (tahun)" value={profile.age} onChange={(v) => setProfile({ ...profile, age: v })} placeholder="mis. 4" type="number" />
      <div style={{ display: "flex", gap: 10 }}>
        <MobileField label="Berat (kg)" value={profile.weight} onChange={(v) => setProfile({ ...profile, weight: v })} placeholder="14.5" type="number" />
        <MobileField label="Tinggi (cm)" value={profile.height} onChange={(v) => setProfile({ ...profile, height: v })} placeholder="98" type="number" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {["Laki-laki", "Perempuan"].map((g) => (
          <button
            key={g}
            type="button"
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
      <div style={{ flex: 1, minHeight: 20 }} />
      <MobilePrimaryButton onClick={onNext} disabled={!ready} icon={ChevronRight}>Lanjut ke Scan</MobilePrimaryButton>
    </div>
  );
}

function MobileScanStep({ onNext, scanned, setScanned }) {
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
          <MobileSecondaryButton icon={Camera} label="Kamera" onClick={() => setScanned(true)} />
          <MobileSecondaryButton icon={Upload} label="Galeri" onClick={() => setScanned(true)} />
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "#8A8272", display: "flex", gap: 5, alignItems: "center" }}>
          <Info size={12} /> Foto contoh (mock) — nanti diganti input foto asli dari kamera device.
        </div>
      )}
      <div style={{ flex: 1, minHeight: 20 }} />
      <MobilePrimaryButton onClick={onNext} disabled={!scanned} icon={ScanLine}>Deteksi lauk pauk</MobilePrimaryButton>
    </div>
  );
}

function MobileDetectionStep({ onNext }) {
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
          <MobileCard key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{d.label}</div>
              <div style={{ fontSize: 11, color: "#8A8272" }}>Estimasi porsi: {d.gram}g (known-plate-size)</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{Math.round(d.confidence * 100)}%</div>
          </MobileCard>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 20 }} />
      <MobilePrimaryButton onClick={onNext} icon={ChevronRight}>Lihat analisis gizi</MobilePrimaryButton>
    </div>
  );
}

function MobileNutritionStep({ profile, onNext, gap, intake, target }) {
  const chartData = ["fe", "zn", "vitc", "protein"].map((n) => ({
    nama: { fe: "Fe", zn: "Zn", vitc: "VitC", protein: "Protein" }[n],
    asupan: intake[n],
    target: target[n],
    tercukupi: intake[n] >= target[n],
  }));
  return (
    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <MobileCard style={{ background: "#FBF6ED" }}>
        <div style={{ fontSize: 12, color: "#8A8272" }}>Bracket AKG</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{ageToBracket(Number(profile.age) || 4)} &middot; {profile.gender}</div>
      </MobileCard>
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
      <div style={{ flex: 1, minHeight: 20 }} />
      <MobilePrimaryButton onClick={onNext} icon={Sparkles}>Cari rekomendasi</MobilePrimaryButton>
    </div>
  );
}

function MobileRecommendationStep({ gap }) {
  const rec = useMemo(() => bestCombo(gap), [gap]);
  if (!rec) return <div style={{ padding: 18 }}>Tidak ada rekomendasi dalam batasan.</div>;
  const names = rec.ids.map((id) => FOODS.find((f) => f.id === id).name);
  return (
    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <MobileCard style={{ background: TEAL, color: "#fff", border: "none" }}>
        <div style={{ fontSize: 11, opacity: 0.85 }}>Rekomendasi pangan komplementer</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{names.join(" + ")}</div>
        <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 4 }}>
          Rp{rec.contrib.cost.toLocaleString("id-ID")} &middot; menutup {Object.keys(WEIGHTS).filter(n => rec.contrib[n] >= gap[n]).length}/4 gap nutrien
        </div>
      </MobileCard>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginTop: 2 }}>Kenapa kombinasi ini?</div>
      <MobileCard style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ReasonRow icon={Sparkles} color={ACCENT} text={`Faktor serapan zat besi ×${rec.contrib.feFactor.toFixed(1)} — vitamin C dalam kombinasi cukup untuk boost non-heme iron.`} />
        <ReasonRow icon={Check} color={OK} text="Menutup gap protein & zat besi sekaligus dalam satu rekomendasi (bukan rule terpisah per-nutrien)." />
        <ReasonRow icon={Info} color={TEAL} text="Bahan pangan lokal, terjangkau, umum tersedia di pasar tradisional." />
      </MobileCard>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginTop: 2 }}>Alternatif lain</div>
      <MobileCard style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, color: "#8A8272" }}>Ikan teri + Jeruk &middot; Rp5.500</div>
        <div style={{ fontSize: 12, color: "#8A8272" }}>Kacang hijau + Bayam &middot; Rp4.000</div>
      </MobileCard>
      <div style={{ flex: 1, minHeight: 20 }} />
      <MobilePrimaryButton onClick={() => {}} icon={ArrowRight}>Simpan ke riwayat</MobilePrimaryButton>
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

function MobileBottomNav() {
  const items = [
    { icon: Home, label: "Beranda" },
    { icon: ScanLine, label: "Scan", active: true },
    { icon: History, label: "Riwayat" },
    { icon: User, label: "Profil" },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${LINE}`, background: "#fff", padding: "8px 0 10px", position: "sticky", bottom: 0, zIndex: 20 }}>
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
// KOMPONEN DESKTOP DASHBOARD (UNTUK VIEW PC >= 768px via Tailwind md:)
// ===========================================================================
function DesktopProfileStep({ profile, setProfile }) {
  const currentBracket = ageToBracket(profile.age);
  const currentTarget = AKG_TABLE[currentBracket];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#EEF4F1] border border-[#3B6357]/20 rounded-xl p-3.5 flex items-center gap-2.5 text-sm text-[#1E2B25]">
        <Info size={18} className="text-[#3B6357] shrink-0" />
        <p className="m-0 leading-relaxed">
          Data antropometri anak digunakan untuk menentukan <strong>Angka Kecukupan Gizi (AKG)</strong> acuan harian berdasarkan Permenkes RI No. 28/2019.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-semibold text-[#6E6759] mb-1 block">Nama Lengkap Anak</span>
          <input
            type="text"
            value={profile.name}
            placeholder="Contoh: Nadia"
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-[#E4DCCB] text-sm text-[#1E2B25] bg-white outline-none focus:border-[#3B6357]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#6E6759] mb-1 block">Umur (Tahun)</span>
          <input
            type="number"
            value={profile.age}
            placeholder="4"
            onChange={(e) => setProfile({ ...profile, age: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-[#E4DCCB] text-sm text-[#1E2B25] bg-white outline-none focus:border-[#3B6357]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#6E6759] mb-1 block">Berat Badan (kg)</span>
          <input
            type="number"
            value={profile.weight}
            placeholder="14.5"
            onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-[#E4DCCB] text-sm text-[#1E2B25] bg-white outline-none focus:border-[#3B6357]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#6E6759] mb-1 block">Tinggi Badan (cm)</span>
          <input
            type="number"
            value={profile.height}
            placeholder="98"
            onChange={(e) => setProfile({ ...profile, height: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-[#E4DCCB] text-sm text-[#1E2B25] bg-white outline-none focus:border-[#3B6357]"
          />
        </label>
      </div>

      <div>
        <span className="text-xs font-semibold text-[#6E6759] mb-1.5 block">Jenis Kelamin</span>
        <div className="flex gap-2.5">
          {["Laki-laki", "Perempuan"].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setProfile({ ...profile, gender: g })}
              className={`flex-1 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                profile.gender === g
                  ? "border-2 border-[#3B6357] bg-[#EEF4F1] text-[#3B6357] font-bold"
                  : "border border-[#E4DCCB] bg-white text-[#1E2B25] font-medium"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#FAF7F0] border border-[#E4DCCB] rounded-xl p-3.5 mt-1">
        <div className="flex justify-between items-center mb-2 text-xs">
          <span className="font-semibold text-[#7A7263]">Kategori Kelompok Usia:</span>
          <span className="font-bold text-[#3B6357] bg-[#EEF4F1] px-2 py-0.5 rounded">
            {currentBracket}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white p-2 rounded-lg border border-[#E4DCCB]">
            <div className="text-[11px] text-[#8A8272]">Zat Besi (Fe)</div>
            <div className="text-sm font-bold text-[#1E2B25] mt-0.5">{currentTarget.fe} mg</div>
          </div>
          <div className="bg-white p-2 rounded-lg border border-[#E4DCCB]">
            <div className="text-[11px] text-[#8A8272]">Seng (Zn)</div>
            <div className="text-sm font-bold text-[#1E2B25] mt-0.5">{currentTarget.zn} mg</div>
          </div>
          <div className="bg-white p-2 rounded-lg border border-[#E4DCCB]">
            <div className="text-[11px] text-[#8A8272]">Vitamin C</div>
            <div className="text-sm font-bold text-[#1E2B25] mt-0.5">{currentTarget.vitc} mg</div>
          </div>
          <div className="bg-white p-2 rounded-lg border border-[#E4DCCB]">
            <div className="text-[11px] text-[#8A8272]">Protein</div>
            <div className="text-sm font-bold text-[#1E2B25] mt-0.5">{currentTarget.protein} g</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopScanStep({ scanned, setScanned }) {
  return (
    <div className="grid grid-cols-[320px_1fr] gap-7 items-center">
      <div className="flex flex-col items-center">
        <div
          onClick={() => setScanned(true)}
          className={`w-full max-w-[320px] aspect-square rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-all ${
            scanned ? "border-[#3B6357] bg-white shadow-md" : "border-[#C2B8A3] bg-[#F7F2E8]"
          }`}
        >
          {scanned ? (
            <PlateIllustration />
          ) : (
            <div className="text-center text-[#8A8272] p-5">
              <div className="w-14 h-14 rounded-2xl bg-[#EAE3D2] inline-flex items-center justify-center mb-3">
                <Camera size={26} className="text-[#1E2B25]" />
              </div>
              <div className="text-sm font-bold text-[#1E2B25]">Ambil Foto Piring</div>
              <div className="text-xs text-[#807869] mt-1">Ketuk di sini untuk simulasi jepretan kamera</div>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 mt-3.5 w-full max-w-[320px]">
          <button
            type="button"
            onClick={() => setScanned(true)}
            className="flex-1 py-2.5 rounded-lg border border-[#E4DCCB] bg-white text-xs font-semibold text-[#1E2B25] flex items-center justify-center gap-1.5 hover:bg-[#FAF7F0] cursor-pointer"
          >
            <Camera size={15} /> Kamera
          </button>
          <button
            type="button"
            onClick={() => setScanned(true)}
            className="flex-1 py-2.5 rounded-lg border border-[#E4DCCB] bg-white text-xs font-semibold text-[#1E2B25] flex items-center justify-center gap-1.5 hover:bg-[#FAF7F0] cursor-pointer"
          >
            <Upload size={15} /> Galeri
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-base font-bold text-[#1E2B25]">Panduan Pengambilan Foto Piring</div>
        <p className="text-sm text-[#61594B] m-0 leading-relaxed">
          Untuk memastikan model <strong>YOLOv8</strong> dapat mendeteksi jenis makanan dan mengestimasi porsi secara akurat, ikuti petunjuk berikut:
        </p>

        <div className="flex flex-col gap-2.5 mt-1">
          <div className="flex gap-2.5 items-start">
            <div className="w-5 h-5 rounded-full bg-[#3B6357] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
            <div>
              <div className="text-sm font-semibold text-[#1E2B25]">Tampak Atas (Top-down View)</div>
              <div className="text-xs text-[#787163]">Arahkan kamera tegak lurus langsung di atas piring makan anak.</div>
            </div>
          </div>
          <div className="flex gap-2.5 items-start">
            <div className="w-5 h-5 rounded-full bg-[#3B6357] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
            <div>
              <div className="text-sm font-semibold text-[#1E2B25]">Seluruh Tepian Piring Terlihat</div>
              <div className="text-xs text-[#787163]">Sistem memanfaatkan diameter fisik piring sebagai referensi kalibrasi gram porsi.</div>
            </div>
          </div>
          <div className="flex gap-2.5 items-start">
            <div className="w-5 h-5 rounded-full bg-[#3B6357] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
            <div>
              <div className="text-sm font-semibold text-[#1E2B25]">Pencahayaan Jelas &amp; Tidak Silau</div>
              <div className="text-xs text-[#787163]">Hindari bayangan tebal agar warna dan tekstur lauk pauk terdeteksi optimal.</div>
            </div>
          </div>
        </div>

        {scanned && (
          <div className="bg-[#EEF6F1] border border-[#3F7A57]/25 rounded-xl p-2.5 flex items-center gap-2 text-xs font-semibold text-[#3F7A57] mt-2">
            <Check size={16} />
            <span>Foto piring berhasil dimuat. Siap diproses oleh model deteksi.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopDetectionStep() {
  return (
    <div className="grid grid-cols-[340px_1fr] gap-7 items-start">
      <div>
        <div className="rounded-2xl overflow-hidden border border-[#E4DCCB] bg-white shadow-sm">
          <PlateIllustration showBoxes detections={MOCK_DETECTIONS} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#807869] mt-2">
          <Info size={13} /> Output model YOLOv8 fine-tuned (Bounding Box &amp; Confidence Score).
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-center">
          <div className="text-sm font-bold text-[#1E2B25]">Komponen Pangan Teridentifikasi (3)</div>
          <span className="text-xs font-semibold text-[#3B6357] bg-[#EEF4F1] px-2 py-0.5 rounded">Kalibrasi Piring Aktif</span>
        </div>

        {MOCK_DETECTIONS.map((d) => {
          const nutrisi = TKPI[d.label];
          const ratio = d.gram / nutrisi.per;
          return (
            <div key={d.id} className="bg-white border border-[#E4DCCB] rounded-xl p-3 flex flex-col gap-2" style={{ borderLeft: `4px solid ${d.color}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-[#1E2B25]">{d.label}</div>
                  <div className="text-xs text-[#787163]">
                    Estimasi Porsi: <strong>{d.gram} gram</strong> &middot; {Math.round(nutrisi.kcal * ratio)} kkal
                  </div>
                </div>
                <div className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: d.color, background: `${d.color}15` }}>
                  {Math.round(d.confidence * 100)}% Cocok
                </div>
              </div>

              <div className="flex gap-3 text-xs text-[#6A6253] border-t border-dashed border-[#E4DCCB] pt-1.5 mt-0.5">
                <span>Protein: <strong>{(nutrisi.protein * ratio).toFixed(1)}g</strong></span>
                <span>Zat Besi: <strong>{(nutrisi.fe * ratio).toFixed(1)}mg</strong></span>
                <span>Seng: <strong>{(nutrisi.zn * ratio).toFixed(1)}mg</strong></span>
                <span>Vit C: <strong>{(nutrisi.vitc * ratio).toFixed(1)}mg</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DesktopNutritionStep({ profile, gap, intake, target }) {
  const currentBracket = ageToBracket(Number(profile.age) || 4);
  const nutrientList = [
    { key: "fe", name: "Zat Besi (Fe)", unit: "mg", intake: intake.fe, target: target.fe },
    { key: "zn", name: "Seng (Zn)", unit: "mg", intake: intake.zn, target: target.zn },
    { key: "vitc", name: "Vitamin C", unit: "mg", intake: intake.vitc, target: target.vitc },
    { key: "protein", name: "Protein", unit: "g", intake: intake.protein, target: target.protein },
  ];

  const chartData = nutrientList.map((n) => ({
    name: n.name.split(" ")[0],
    asupan: n.intake,
    target: n.target,
    tercukupi: n.intake >= n.target,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-[#FAF5EA] border border-[#E4DCCB] rounded-xl p-3.5 flex justify-between items-center">
        <div>
          <div className="text-xs text-[#807869]">Standar Angka Kecukupan Gizi (AKG)</div>
          <div className="text-sm font-bold text-[#1E2B25]">Kelompok Usia {currentBracket} &middot; {profile.gender}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#807869]">Status Asupan Piring Ini:</div>
          <div className="text-sm font-bold text-[#A34A3E]">Belum Memenuhi Target</div>
        </div>
      </div>

      <div className="bg-white border border-[#E4DCCB] rounded-2xl p-4 pt-3">
        <div className="text-sm font-bold text-[#1E2B25] mb-2">Perbandingan Asupan Foto vs Target AKG Harian</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE8DC" />
            <XAxis dataKey="name" tick={{ fontSize: 11.5 }} />
            <YAxis tick={{ fontSize: 10.5 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} formatter={(value, name) => [`${value}`, name === "asupan" ? "Asupan Makanan" : "Target AKG"]} />
            <Bar dataKey="asupan" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.tercukupi ? OK : DANGER} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {nutrientList.map((n) => {
          const tercukupi = n.intake >= n.target;
          const deficit = (n.target - n.intake).toFixed(1);
          const percent = Math.min(100, Math.round((n.intake / n.target) * 100));
          return (
            <div key={n.key} className="bg-white border border-[#E4DCCB] rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-[#1E2B25]">
                <span>{n.name}</span>
                {tercukupi ? (
                  <span className="text-[#3F7A57] flex items-center gap-0.5"><Check size={12} /> Cukup</span>
                ) : (
                  <span className="text-[#A34A3E]">-{deficit} {n.unit}</span>
                )}
              </div>
              <div className="w-full h-1.5 rounded bg-[#EAE4D7] overflow-hidden">
                <div className="h-full rounded" style={{ width: `${percent}%`, background: tercukupi ? OK : DANGER }} />
              </div>
              <div className="flex justify-between text-[11px] text-[#807869]">
                <span>{n.intake} / {n.target} {n.unit}</span>
                <span className="font-semibold">{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DesktopRecommendationStep({ gap, onReset }) {
  const rec = useMemo(() => bestCombo(gap), [gap]);
  if (!rec) return <div className="p-4">Tidak ada rekomendasi dalam batasan.</div>;

  const names = rec.ids.map((id) => FOODS.find((f) => f.id === id).name);
  const coveredCount = Object.keys(WEIGHTS).filter((n) => rec.contrib[n] >= gap[n]).length;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="flex flex-col gap-3.5">
        <div className="bg-gradient-to-br from-[#3B6357] to-[#2A483F] text-white rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs opacity-90">
            <Sparkles size={14} className="text-[#F2C17D]" /> Rekomendasi Pangan Komplementer Terbaik
          </div>
          <div className="text-xl font-extrabold mt-2 tracking-tight">
            {names.join(" + ")}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-white/20 text-xs font-semibold">
            <div className="bg-white/15 px-2.5 py-1 rounded-full">
              Estimasi Biaya: Rp{rec.contrib.cost.toLocaleString("id-ID")}
            </div>
            <div className="bg-white/15 px-2.5 py-1 rounded-full">
              Menutup {coveredCount}/4 Gap Nutrien
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4DCCB] rounded-2xl p-4 flex flex-col gap-2.5">
          <div className="text-sm font-bold text-[#1E2B25]">Rasionalisasi Biokimia &amp; Gizi</div>
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded bg-[#C97B2E]/15 flex items-center justify-center shrink-0">
              <Sparkles size={14} className="text-[#C97B2E]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1E2B25]">Bioavailabilitas Zat Besi Meningkat ×2.0</div>
              <div className="text-xs text-[#61594B] leading-relaxed mt-0.5">Kandungan Vitamin C tinggi pada kombinasi ini mereduksi ion feri (Fe3+) menjadi fero (Fe2+) yang siap diserap tubuh anak.</div>
            </div>
          </div>
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded bg-[#3F7A57]/15 flex items-center justify-center shrink-0">
              <Check size={14} className="text-[#3F7A57]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1E2B25]">Penutupan Gap Ganda Sekaligus</div>
              <div className="text-xs text-[#61594B] leading-relaxed mt-0.5">Kombinasi menutupi defisit zat besi dan seng secara bersamaan tanpa menimbulkan kompetisi absorbsi berlebih.</div>
            </div>
          </div>
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded bg-[#3B6357]/15 flex items-center justify-center shrink-0">
              <Utensils size={14} className="text-[#3B6357]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1E2B25]">Pangan Lokal &amp; Terjangkau</div>
              <div className="text-xs text-[#61594B] leading-relaxed mt-0.5">Bahan mudah diperoleh di pasar tradisional terdekat dengan harga ramah bagi keluarga.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="bg-white border border-[#E4DCCB] rounded-2xl p-4 flex flex-col gap-3">
          <div className="text-sm font-bold text-[#1E2B25]">Pilihan Menu Alternatif</div>
          <p className="text-xs text-[#787163] m-0">Jika bahan utama tidak tersedia, berikut alternatif menu komplementer yang sebanding:</p>
          <div className="bg-[#FAF7F0] border border-[#E4DCCB] rounded-xl p-2.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-[#1E2B25]">Ikan Teri Segar + Jeruk Manis</span>
              <span className="text-[#3B6357]">Rp5.500</span>
            </div>
            <div className="text-[11px] text-[#787163] mt-0.5">Kalsium dan zat besi hemin dari ikan teri didukung asam askorbat jeruk.</div>
          </div>
          <div className="bg-[#FAF7F0] border border-[#E4DCCB] rounded-xl p-2.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-[#1E2B25]">Kacang Hijau + Sayur Bayam</span>
              <span className="text-[#3B6357]">Rp4.000</span>
            </div>
            <div className="text-[11px] text-[#787163] mt-0.5">Kombinasi nabati kaya zat besi dengan serat halus ramah pencernaan anak.</div>
          </div>
        </div>

        <div className="bg-[#F5F1E8] border border-[#E4DCCB] rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#1E2B25]">Uji Foto / Balita Lain?</div>
            <div className="text-[11px] text-[#807869]">Reset alur prototype untuk pengujian baru</div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="px-3.5 py-1.5 bg-white border border-[#E4DCCB] rounded-lg text-xs font-semibold text-[#1E2B25] flex items-center gap-1.5 hover:bg-[#FAF7F0] cursor-pointer"
          >
            <RotateCcw size={13} /> Mulai Ulang
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MAIN COMPONENT DENGAN TAILWIND RESPONSIVE (md: BREAKPOINT)
// ===========================================================================
export default function FitaAppPrototype() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({ name: "", age: "4", weight: "14.5", height: "98", gender: "Perempuan" });
  const [scanned, setScanned] = useState(false);

  // Perhitungan Target & Asupan
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

  const isProfileValid = profile.name && profile.age && profile.weight && profile.height;

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleReset = () => {
    setStep(1);
    setScanned(false);
  };

  const nextButtonConfig = {
    1: { label: "Lanjut ke Scan", disabled: !isProfileValid, icon: ChevronRight },
    2: { label: "Deteksi lauk pauk", disabled: !scanned, icon: ScanLine },
    3: { label: "Lihat analisis gizi", disabled: false, icon: ChevronRight },
    4: { label: "Cari rekomendasi", disabled: false, icon: Sparkles },
    5: { label: "Mulai Ulang", disabled: false, icon: RotateCcw, onClick: handleReset },
  }[step];

  const currentStepInfo = STEPS_DATA[step - 1];

  return (
    <>
      {/* ================================================================= */}
      {/* 1. VIEW HP (< 768px / block md:hidden): 100% Desain Awal Seamless */}
      {/* ================================================================= */}
      <div className="block md:hidden w-full min-h-screen min-h-[100dvh] bg-[#F6F2EA] flex flex-col">
        <MobileAppBar title={STEP_TITLES[step - 1]} step={step} totalSteps={5} />

        <div className="flex-1 flex flex-col overflow-y-auto">
          {step === 1 && <MobileProfileStep profile={profile} setProfile={setProfile} onNext={() => setStep(2)} />}
          {step === 2 && <MobileScanStep scanned={scanned} setScanned={setScanned} onNext={() => setStep(3)} />}
          {step === 3 && <MobileDetectionStep onNext={() => setStep(4)} />}
          {step === 4 && <MobileNutritionStep profile={profile} gap={gap} intake={intake} target={target} onNext={() => setStep(5)} />}
          {step === 5 && <MobileRecommendationStep gap={gap} />}
        </div>

        {step > 1 && (
          <div className="px-4 py-2 flex">
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 bg-transparent border-none text-[#8A8272] text-xs cursor-pointer py-1"
            >
              <ChevronLeft size={14} /> Kembali
            </button>
          </div>
        )}

        <MobileBottomNav />
      </div>

      {/* ================================================================= */}
      {/* 2. VIEW PC (>= 768px / hidden md:flex): Web Dashboard 2-Kolom    */}
      {/* ================================================================= */}
      <div className="hidden md:flex flex-col min-h-screen w-full bg-[#F5EFE4]">
        {/* Header Desktop */}
        <header className="bg-white border-b border-[#E4DCCB] shadow-sm sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B6357] to-[#234037] flex items-center justify-center text-white shadow-md">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[#1E2B25] leading-tight">FITA</div>
                <div className="text-xs text-[#787163]">
                  Sistem Deteksi &amp; Rekomendasi Pangan Gizi Anak
                </div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EEF4F1] text-[#3B6357] border border-[#3B6357]/15">
              <BookOpen size={13} /> Permenkes RI No. 28/2019
            </span>
          </div>
        </header>

        {/* Dashboard 2-Kolom */}
        <div className="max-w-7xl w-full mx-auto p-7 grid grid-cols-[320px_1fr] lg:grid-cols-[340px_1fr] gap-7 items-start flex-1">
          {/* Kolom Kiri: Sidebar Info & Stepper */}
          <aside className="flex flex-col gap-4 sticky top-20">
            <div className="bg-white rounded-2xl border border-[#E4DCCB] shadow-sm p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#EEF4F1] flex items-center justify-center text-[#3B6357]">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#1E2B25]">
                    {profile.name || "Nama Balita"}
                  </div>
                  <div className="text-xs text-[#807869]">
                    {profile.age} Th &middot; {profile.gender}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-2.5 border-t border-[#E4DCCB] text-xs text-[#787163]">
                <div>BB: <strong>{profile.weight || "-"} kg</strong></div>
                <div>&middot;</div>
                <div>TB: <strong>{profile.height || "-"} cm</strong></div>
                <div>&middot;</div>
                <div className="text-[#3B6357] font-semibold">{ageToBracket(Number(profile.age) || 4)}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E4DCCB] shadow-sm p-4">
              <div className="text-xs font-bold text-[#7A7263] uppercase tracking-wider">
                Tahapan Analisis
              </div>
              <div className="flex flex-col gap-1.5 mt-3">
                {STEPS_DATA.map((s) => {
                  const isActive = step === s.id;
                  const isCompleted = step > s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (s.id <= step || (s.id === 2 && isProfileValid) || (s.id === 3 && scanned)) {
                          setStep(s.id);
                        }
                      }}
                      className={`flex items-center gap-3 p-2.5 rounded-lg transition-all text-left cursor-pointer ${
                        isActive
                          ? "bg-[#EEF4F1] border border-[#3B6357]/25"
                          : "hover:bg-[#FAF7F0] border border-transparent"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCompleted
                          ? "bg-[#3F7A57] text-white"
                          : isActive
                          ? "bg-[#3B6357] text-white shadow"
                          : "bg-[#EAE4D7] text-[#787163]"
                      }`}>
                        {isCompleted ? <Check size={14} /> : s.id}
                      </div>
                      <div>
                        <div className={`text-xs font-semibold ${isActive ? "text-[#3B6357] font-bold" : "text-[#1E2B25]"}`}>
                          {s.title}
                        </div>
                        <div className="text-[11px] text-[#787163]">{s.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#FAF7F0] rounded-2xl border border-[#E4DCCB] p-4 text-xs text-[#70695B] leading-relaxed">
              <div className="font-bold text-[#1E2B25] mb-1 flex items-center gap-1.5">
                <Info size={14} className="text-[#3B6357]" /> Acuan Metodologi
              </div>
              Sistem mengombinasikan deteksi lauk berbasis vision untuk estimasi porsi (gram) dan model optimasi non-linear untuk merekomendasikan pangan komplementer bersinergi.
            </div>
          </aside>

          {/* Kolom Kanan: Main Workspace Card */}
          <main className="bg-white rounded-3xl border border-[#E4DCCB] shadow-sm overflow-hidden flex flex-col min-h-[580px]">
            <div className="px-7 py-5 border-b border-[#E4DCCB] bg-[#FCFAF6] flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#3B6357] uppercase tracking-wider">
                  Langkah {step} dari 5
                </div>
                <h1 className="text-xl font-extrabold text-[#1E2B25] m-0 mt-0.5">
                  {currentStepInfo.title}
                </h1>
                <div className="text-xs text-[#7A7263] mt-0.5">
                  {currentStepInfo.subtitle}
                </div>
              </div>

              <div className="flex gap-1.5">
                {STEPS_DATA.map((s) => (
                  <div
                    key={s.id}
                    className={`h-2 rounded transition-all ${
                      step === s.id ? "w-6 bg-[#C97B2E]" : step > s.id ? "w-2 bg-[#3B6357]" : "w-2 bg-[#E4DCCB]"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="p-7 flex-1 flex flex-col">
              {step === 1 && <DesktopProfileStep profile={profile} setProfile={setProfile} />}
              {step === 2 && <DesktopScanStep scanned={scanned} setScanned={setScanned} />}
              {step === 3 && <DesktopDetectionStep />}
              {step === 4 && <DesktopNutritionStep profile={profile} gap={gap} intake={intake} target={target} />}
              {step === 5 && <DesktopRecommendationStep gap={gap} onReset={handleReset} />}
            </div>

            <div className="px-7 py-4 border-t border-[#E4DCCB] bg-[#FCFAF6] flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#787163] hover:text-[#1E2B25] hover:bg-black/5 rounded-lg transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} /> Kembali
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={nextButtonConfig.onClick || handleNext}
                disabled={nextButtonConfig.disabled}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all ${
                  nextButtonConfig.disabled
                    ? "bg-[#D8D0C0] cursor-not-allowed"
                    : "bg-[#C97B2E] hover:bg-[#B56C23] cursor-pointer shadow-md hover:-translate-y-0.5"
                }`}
              >
                {nextButtonConfig.label}
                {nextButtonConfig.icon && <nextButtonConfig.icon size={16} />}
              </button>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
