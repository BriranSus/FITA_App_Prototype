import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Camera, Upload, ChevronRight, ChevronLeft, User, Home, History,
  ScanLine, Sparkles, Check, AlertCircle, Info, ArrowRight, RotateCcw,
  Utensils, BookOpen, HeartPulse,
} from "lucide-react";
import "./FitaResponsive.css";

// ===========================================================================
// DESAIN TOKEN (Konsisten dengan prototype awal)
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
// PLATE ILLUSTRATION (SVG asli)
// ===========================================================================
function PlateIllustration({ showBoxes = false, detections = [] }) {
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" style={{ display: "block" }}>
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
// VIEW HP (DESAIN AWAL SEAMLESS TANPA BORDER)
// ===========================================================================
function MobileAppBar({ title, step, totalSteps }) {
  return (
    <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${LINE}`, background: "#fff", position: "sticky", top: 0, zIndex: 30 }}>
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

function MobileRecommendationStep({ gap, onReset }) {
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
      <MobilePrimaryButton onClick={onReset || (() => {})} icon={ArrowRight}>Simpan ke riwayat</MobilePrimaryButton>
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

function MobileBottomNav({ setStep }) {
  const items = [
    { icon: Home, label: "Beranda", action: () => setStep(1) },
    { icon: ScanLine, label: "Scan", active: true, action: () => setStep(2) },
    { icon: History, label: "Riwayat", action: () => setStep(5) },
    { icon: User, label: "Profil", action: () => setStep(1) },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${LINE}`, background: "#fff", padding: "8px 0 calc(10px + env(safe-area-inset-bottom, 0px))" }}>
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.action}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            color: it.active ? ACCENT : "#B0A891", background: "none", border: "none", cursor: "pointer", padding: "2px 0",
          }}
        >
          <it.icon size={18} />
          <span style={{ fontSize: 9.5 }}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ===========================================================================
// VIEW PC (WEB DASHBOARD 2-KOLOM MODERN)
// ===========================================================================
function DesktopProfileStep({ profile, setProfile }) {
  const currentBracket = ageToBracket(profile.age);
  const currentTarget = AKG_TABLE[currentBracket];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        background: "#EEF4F1", border: "1px solid rgba(59, 99, 87, 0.2)",
        borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center",
      }}>
        <Info size={18} color={TEAL} style={{ flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: INK, margin: 0, lineHeight: 1.5 }}>
          Data antropometri anak digunakan untuk menentukan <strong>Angka Kecukupan Gizi (AKG)</strong> acuan harian berdasarkan Permenkes RI No. 28/2019.
        </p>
      </div>

      <div className="fita-profile-grid">
        <DesktopField
          label="Nama Lengkap Anak"
          value={profile.name}
          onChange={(v) => setProfile({ ...profile, name: v })}
          placeholder="Contoh: Nadia Safira"
        />
        <DesktopField
          label="Umur (Tahun)"
          value={profile.age}
          onChange={(v) => setProfile({ ...profile, age: v })}
          placeholder="4"
          type="number"
        />
        <DesktopField
          label="Berat Badan (kg)"
          value={profile.weight}
          onChange={(v) => setProfile({ ...profile, weight: v })}
          placeholder="14.5"
          type="number"
        />
        <DesktopField
          label="Tinggi Badan (cm)"
          value={profile.height}
          onChange={(v) => setProfile({ ...profile, height: v })}
          placeholder="98"
          type="number"
        />
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#6E6759", marginBottom: 6 }}>Jenis Kelamin</div>
        <div style={{ display: "flex", gap: 10 }}>
          {["Laki-laki", "Perempuan"].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setProfile({ ...profile, gender: g })}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 8, fontSize: 13.5,
                border: profile.gender === g ? `2px solid ${TEAL}` : `1px solid ${LINE}`,
                background: profile.gender === g ? "#EEF4F1" : "#FFFFFF",
                color: profile.gender === g ? TEAL : INK,
                cursor: "pointer", fontWeight: profile.gender === g ? 700 : 500,
                transition: "all 0.2s ease",
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        background: "#FAF7F0", border: `1px solid ${LINE}`,
        borderRadius: 12, padding: "14px 16px", marginTop: 4,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#7A7263" }}>Kategori Kelompok Usia:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEAL, background: "#EEF4F1", padding: "3px 8px", borderRadius: 6 }}>
            {currentBracket}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <div style={{ background: "#FFFFFF", padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 11, color: "#8A8272" }}>Zat Besi (Fe)</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }}>{currentTarget.fe} mg</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 11, color: "#8A8272" }}>Seng (Zn)</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }}>{currentTarget.zn} mg</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 11, color: "#8A8272" }}>Vitamin C</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }}>{currentTarget.vitc} mg</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 11, color: "#8A8272" }}>Protein</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }}>{currentTarget.protein} g</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6E6759", marginBottom: 5 }}>{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 8,
          border: `1px solid ${LINE}`, fontSize: 14, outline: "none", color: INK,
          background: "#FFFFFF",
        }}
      />
    </label>
  );
}

function DesktopScanStep({ scanned, setScanned }) {
  return (
    <div className="fita-scan-layout">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          onClick={() => setScanned(true)}
          style={{
            width: "100%", maxWidth: 320, aspectRatio: "1", borderRadius: 16,
            border: `2px dashed ${scanned ? TEAL : "#C2B8A3"}`,
            background: scanned ? "#FFFFFF" : "#F7F2E8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", position: "relative", overflow: "hidden",
            boxShadow: scanned ? "0 8px 24px rgba(59,99,87,0.12)" : "none",
          }}
        >
          {scanned ? (
            <PlateIllustration />
          ) : (
            <div style={{ textAlign: "center", color: "#8A8272", padding: 20 }}>
              <div style={{
                width: 54, height: 54, borderRadius: 14, background: "#EAE3D2",
                display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
              }}>
                <Camera size={26} color={INK} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Ambil Foto Piring</div>
              <div style={{ fontSize: 12, color: "#807869", marginTop: 4 }}>
                Ketuk di sini untuk simulasi jepretan kamera
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, width: "100%", maxWidth: 320 }}>
          <button type="button" onClick={() => setScanned(true)} className="fita-btn-secondary" style={{ flex: 1, padding: "10px 0" }}>
            <Camera size={16} /> Kamera
          </button>
          <button type="button" onClick={() => setScanned(true)} className="fita-btn-secondary" style={{ flex: 1, padding: "10px 0" }}>
            <Upload size={16} /> Galeri
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Panduan Pengambilan Foto Piring</div>
        <p style={{ fontSize: 13, color: "#61594B", margin: 0, lineHeight: 1.6 }}>
          Untuk memastikan model <strong>YOLOv8</strong> dapat mendeteksi jenis makanan dan mengestimasi porsi secara akurat, ikuti petunjuk berikut:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: TEAL, color: "#fff", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>1</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Tampak Atas (Top-down View)</div>
              <div style={{ fontSize: 11.5, color: "#787163", lineHeight: 1.4 }}>Arahkan kamera tegak lurus langsung di atas piring makan anak.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: TEAL, color: "#fff", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>2</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Seluruh Tepian Piring Terlihat</div>
              <div style={{ fontSize: 11.5, color: "#787163", lineHeight: 1.4 }}>Sistem memanfaatkan diameter fisik piring sebagai referensi kalibrasi gram porsi.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: TEAL, color: "#fff", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>3</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Pencahayaan Jelas &amp; Tidak Silau</div>
              <div style={{ fontSize: 11.5, color: "#787163", lineHeight: 1.4 }}>Hindari bayangan tebal agar warna dan tekstur lauk pauk terdeteksi optimal.</div>
            </div>
          </div>
        </div>

        {scanned && (
          <div style={{ background: "#EEF6F1", border: "1px solid rgba(63, 122, 87, 0.25)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <Check size={16} color={OK} />
            <span style={{ fontSize: 12.5, color: OK, fontWeight: 600 }}>Foto piring berhasil dimuat. Siap diproses oleh model deteksi.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopDetectionStep() {
  return (
    <div className="fita-detection-layout">
      <div>
        <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${LINE}`, background: "#FFFFFF", boxShadow: "0 4px 16px rgba(30,43,37,0.06)" }}>
          <PlateIllustration showBoxes detections={MOCK_DETECTIONS} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#807869", marginTop: 8 }}>
          <Info size={13} /> Output model YOLOv8 fine-tuned (Bounding Box &amp; Confidence Score).
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>Komponen Pangan Teridentifikasi (3)</div>
          <span style={{ fontSize: 11.5, color: TEAL, fontWeight: 600, background: "#EEF4F1", padding: "3px 8px", borderRadius: 6 }}>Kalibrasi Piring Aktif</span>
        </div>

        {MOCK_DETECTIONS.map((d) => {
          const nutrisi = TKPI[d.label];
          const ratio = d.gram / nutrisi.per;
          return (
            <div key={d.id} style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, borderLeft: `4px solid ${d.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{d.label}</div>
                  <div style={{ fontSize: 11.5, color: "#787163" }}>
                    Estimasi Porsi: <strong>{d.gram} gram</strong> &middot; {Math.round(nutrisi.kcal * ratio)} kkal
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: d.color, background: `${d.color}15`, padding: "4px 8px", borderRadius: 6 }}>
                  {Math.round(d.confidence * 100)}% Cocok
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6A6253", borderTop: `1px dashed ${LINE}`, paddingTop: 6, marginTop: 2 }}>
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
  const currentBracket = ageToBracket(profile.age);
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
    <div className="fita-nutrition-layout">
      <div style={{ background: "#FAF5EA", border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11.5, color: "#807869" }}>Standar Angka Kecukupan Gizi (AKG)</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Kelompok Usia {currentBracket} ({profile.gender})</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#807869" }}>Status Asupan Piring Ini:</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: DANGER }}>Belum Memenuhi Target</div>
        </div>
      </div>

      <div style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 14, padding: "16px 14px 10px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10 }}>Perbandingan Asupan Foto vs Target AKG Harian</div>
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

      <div className="fita-nutrient-cards-grid">
        {nutrientList.map((n) => {
          const tercukupi = n.intake >= n.target;
          const deficit = (n.target - n.intake).toFixed(1);
          const percent = Math.min(100, Math.round((n.intake / n.target) * 100));
          return (
            <div key={n.key} style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{n.name}</span>
                {tercukupi ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: OK, display: "flex", alignItems: "center", gap: 2 }}><Check size={12} /> Cukup</span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: DANGER }}>-{deficit} {n.unit}</span>
                )}
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 3, background: "#EAE4D7", overflow: "hidden" }}>
                <div style={{ width: `${percent}%`, height: "100%", background: tercukupi ? OK : DANGER, borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#807869" }}>
                <span>{n.intake} / {n.target} {n.unit}</span>
                <span style={{ fontWeight: 600 }}>{percent}%</span>
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
  if (!rec) return <div style={{ padding: 18 }}>Tidak ada rekomendasi dalam batasan.</div>;

  const names = rec.ids.map((id) => FOODS.find((f) => f.id === id).name);
  const coveredCount = Object.keys(WEIGHTS).filter((n) => rec.contrib[n] >= gap[n]).length;

  return (
    <div className="fita-recommendation-layout">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "linear-gradient(135deg, #3B6357 0%, #2A483F 100%)", color: "#FFFFFF", borderRadius: 16, padding: "18px 20px", boxShadow: "0 8px 24px rgba(42, 72, 63, 0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.9 }}>
            <Sparkles size={14} color="#F2C17D" /> Rekomendasi Pangan Komplementer Terbaik
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8, letterSpacing: "-0.3px" }}>
            {names.join(" + ")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.18)", paddingTop: 10 }}>
            <div style={{ background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              Estimasi Biaya: Rp{rec.contrib.cost.toLocaleString("id-ID")}
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              Menutup {coveredCount}/4 Gap Nutrien
            </div>
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Rasionalisasi Biokimia &amp; Gizi</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={14} color={ACCENT} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Bioavailabilitas Zat Besi Meningkat ×2.0</div>
              <div style={{ fontSize: 11.5, color: "#61594B", lineHeight: 1.4, marginTop: 2 }}>Kandungan Vitamin C tinggi pada kombinasi ini mereduksi ion feri (Fe3+) menjadi fero (Fe2+) yang siap diserap tubuh anak.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `${OK}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={14} color={OK} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Penutupan Gap Ganda Sekaligus</div>
              <div style={{ fontSize: 11.5, color: "#61594B", lineHeight: 1.4, marginTop: 2 }}>Kombinasi menutupi defisit zat besi dan seng secara bersamaan tanpa menimbulkan kompetisi absorbsi berlebih.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `${TEAL}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Utensils size={14} color={TEAL} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Pangan Lokal &amp; Terjangkau</div>
              <div style={{ fontSize: 11.5, color: "#61594B", lineHeight: 1.4, marginTop: 2 }}>Bahan mudah diperoleh di pasar tradisional terdekat dengan harga ramah bagi keluarga.</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Pilihan Menu Alternatif</div>
          <p style={{ fontSize: 12, color: "#787163", margin: 0 }}>Jika bahan utama tidak tersedia, berikut alternatif menu komplementer yang sebanding:</p>
          <div style={{ background: "#FAF7F0", border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Ikan Teri Segar + Jeruk Manis</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: TEAL }}>Rp5.500</span>
            </div>
            <div style={{ fontSize: 11, color: "#787163", marginTop: 3 }}>Kalsium dan zat besi hemin dari ikan teri didukung asam askorbat jeruk.</div>
          </div>
          <div style={{ background: "#FAF7F0", border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Kacang Hijau + Sayur Bayam</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: TEAL }}>Rp4.000</span>
            </div>
            <div style={{ fontSize: 11, color: "#787163", marginTop: 3 }}>Kombinasi nabati kaya zat besi dengan serat halus ramah pencernaan anak.</div>
          </div>
        </div>

        <div style={{ background: "#F5F1E8", border: `1px solid ${LINE}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Uji Foto / Balita Lain?</div>
            <div style={{ fontSize: 11, color: "#807869" }}>Reset alur prototype untuk pengujian baru</div>
          </div>
          <button type="button" onClick={onReset} className="fita-btn-secondary" style={{ padding: "8px 14px", fontSize: 12 }}>
            <RotateCcw size={13} /> Mulai Ulang
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MAIN COMPONENT DENGAN AUTO-RESPONSIVE MURNI
// ===========================================================================
export default function FitaAppPrototype() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({
    name: "Nadia",
    age: "4",
    weight: "14.5",
    height: "98",
    gender: "Perempuan",
  });
  const [scanned, setScanned] = useState(false);

  // Kalkulasi AKG & Intake
  const target = AKG_TABLE[ageToBracket(profile.age)];
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
    return {
      fe: +totals.fe.toFixed(1),
      zn: +totals.zn.toFixed(1),
      vitc: +totals.vitc.toFixed(1),
      protein: +totals.protein.toFixed(1),
    };
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
      {/* VIEW HP: Aktif otomatis di layar < 768px (Desain Asli Tanpa Border)*/}
      {/* ================================================================= */}
      <div className="fita-mobile-view-container">
        <div className="fita-mobile-app-body">
          <MobileAppBar title={STEP_TITLES[step - 1]} step={step} totalSteps={5} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            {step === 1 && <MobileProfileStep profile={profile} setProfile={setProfile} onNext={() => setStep(2)} />}
            {step === 2 && <MobileScanStep scanned={scanned} setScanned={setScanned} onNext={() => setStep(3)} />}
            {step === 3 && <MobileDetectionStep onNext={() => setStep(4)} />}
            {step === 4 && <MobileNutritionStep profile={profile} gap={gap} intake={intake} target={target} onNext={() => setStep(5)} />}
            {step === 5 && <MobileRecommendationStep gap={gap} onReset={handleReset} />}
          </div>

          {step > 1 && (
            <div style={{ padding: "0 18px 8px", display: "flex" }}>
              <button
                type="button"
                onClick={handleBack}
                style={{
                  display: "flex", alignItems: "center", gap: 4, background: "none",
                  border: "none", color: "#8A8272", fontSize: 12, cursor: "pointer", padding: "6px 0",
                }}
              >
                <ChevronLeft size={14} /> Kembali
              </button>
            </div>
          )}

          <MobileBottomNav setStep={setStep} />
        </div>
      </div>

      {/* ================================================================= */}
      {/* VIEW PC: Aktif otomatis di layar >= 768px (Web Dashboard 2-Kolom)  */}
      {/* ================================================================= */}
      <div className="fita-desktop-view-container">
        {/* Header Desktop */}
        <header className="fita-desktop-header">
          <div className="fita-desktop-header-inner">
            <div className="fita-brand">
              <div className="fita-brand-logo">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="fita-brand-title">FITA</div>
                <div className="fita-brand-subtitle">
                  Sistem Deteksi &amp; Rekomendasi Pangan Gizi Anak
                </div>
              </div>
            </div>

            <span className="fita-badge fita-badge-teal">
              <BookOpen size={13} /> Permenkes RI No. 28/2019
            </span>
          </div>
        </header>

        {/* Dashboard Container 2-Kolom */}
        <div className="fita-dashboard-container">
          {/* Kolom Kiri: Sidebar Info & Stepper */}
          <aside className="fita-desktop-sidebar">
            <div className="fita-sidebar-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", background: "#EEF4F1",
                  display: "flex", alignItems: "center", justifyContent: "center", color: TEAL,
                }}>
                  <User size={19} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                    {profile.name || "Nama Balita"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#807869" }}>
                    {profile.age} Th &middot; {profile.gender}
                  </div>
                </div>
              </div>

              <div style={{
                display: "flex", gap: 8, marginTop: 12, paddingTop: 10,
                borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: "#787163",
              }}>
                <div>BB: <strong>{profile.weight || "-"} kg</strong></div>
                <div>&middot;</div>
                <div>TB: <strong>{profile.height || "-"} cm</strong></div>
                <div>&middot;</div>
                <div style={{ color: TEAL, fontWeight: 600 }}>{ageToBracket(profile.age)}</div>
              </div>
            </div>

            <div className="fita-sidebar-card">
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7A7263", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Tahapan Analisis
              </div>
              <div className="fita-stepper-list">
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
                      className={`fita-step-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                    >
                      <div className="fita-step-num">
                        {isCompleted ? <Check size={14} /> : s.id}
                      </div>
                      <div>
                        <div className="fita-step-text-title">{s.title}</div>
                        <div className="fita-step-text-sub">{s.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fita-sidebar-card" style={{ background: "#FAF7F0", fontSize: 12, color: "#70695B", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: INK, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Info size={14} color={TEAL} /> Acuan Metodologi
              </div>
              Sistem mengombinasikan deteksi lauk berbasis vision untuk estimasi porsi (gram) dan model optimasi non-linear untuk merekomendasikan pangan komplementer bersinergi.
            </div>
          </aside>

          {/* Kolom Kanan: Main Workspace Card */}
          <main className="fita-desktop-workspace">
            <div className="fita-workspace-header">
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Langkah {step} dari 5
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: INK, margin: "3px 0 0" }}>
                  {currentStepInfo.title}
                </h1>
                <div style={{ fontSize: 13, color: "#7A7263", marginTop: 2 }}>
                  {currentStepInfo.subtitle}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {STEPS_DATA.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      width: step === s.id ? 24 : 8, height: 8, borderRadius: 4,
                      background: step === s.id ? ACCENT : step > s.id ? TEAL : LINE,
                      transition: "all 0.3s ease",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="fita-workspace-body">
              {step === 1 && <DesktopProfileStep profile={profile} setProfile={setProfile} />}
              {step === 2 && <DesktopScanStep scanned={scanned} setScanned={setScanned} />}
              {step === 3 && <DesktopDetectionStep />}
              {step === 4 && <DesktopNutritionStep profile={profile} gap={gap} intake={intake} target={target} />}
              {step === 5 && <DesktopRecommendationStep gap={gap} onReset={handleReset} />}
            </div>

            <div className="fita-workspace-footer">
              {step > 1 ? (
                <button type="button" onClick={handleBack} className="fita-btn-ghost">
                  <ChevronLeft size={16} /> Kembali
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={nextButtonConfig.onClick || handleNext}
                disabled={nextButtonConfig.disabled}
                className="fita-btn-primary"
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
