import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

const DB_PASSWORD = "MommaRose1!";

function DatabasePasswordGate({ onUnlock }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);

  const handleSubmit = () => {
    if (input === DB_PASSWORD) {
      sessionStorage.setItem("zyze_db_auth", "true");
      onUnlock();
    } else {
      setError(true);
      setInput("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div style={{ padding: "60px 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 4, padding: 28 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, color: "#F0EDE8", marginBottom: 4 }}>Database Access</div>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 24 }}>This area is restricted to the Zyze team only.</div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555", marginBottom: 12 }}>Enter Passcode</div>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              type={show ? "text" : "password"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="Passcode..."
              style={{ width: "100%", background: "#0D0D0D", border: `1px solid ${error ? "#E07070" : "#2A2A2A"}`, borderRadius: 3, padding: "14px 48px 14px 16px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#F0EDE8", outline: "none", boxSizing: "border-box" }}
              autoFocus
            />
            <button onClick={() => setShow(!show)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 13 }}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: "#E07070", marginBottom: 12, textAlign: "center" }}>Incorrect passcode. Try again.</div>}
          <button onClick={handleSubmit} style={{ width: "100%", background: "#C9A87C", color: "#0D0D0D", border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: 14, borderRadius: 3, cursor: "pointer" }}>
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}

const FIT_RATINGS = ["Too Tight", "Slightly Tight", "True to Size", "Slightly Loose", "Too Loose"];
const LENGTH_RATINGS = ["Too Short", "True to Size", "Too Long"];
const ISSUE_OPTIONS = ["Gaping waist", "Muffin top", "Hip pulling", "Thigh bunching", "Seat too baggy", "Waistband digging", "Length too long", "Ankle break", "Front rise issues", "Back rise issues"];

const SYSTEM_PROMPT = `You are a fit intelligence analyst for Zyze, a fashion-tech company that builds real-world sizing data from try-on videos.

A try-on video transcript will be provided. Extract the following structured data as JSON only — no preamble, no markdown, no explanation:

{
  "brand": "brand name mentioned",
  "garment": "style or garment name mentioned",
  "size": "size tried on (number, letter, or both)",
  "waist_fit": "one of: Too Tight, Slightly Tight, True to Size, Slightly Loose, Too Loose",
  "hip_fit": "one of: Too Tight, Slightly Tight, True to Size, Slightly Loose, Too Loose",
  "length_fit": "one of: Too Short, True to Size, Too Long",
  "other_issues": ["array of specific issues mentioned"],
  "raw_feedback": "direct quote or close paraphrase of key fit feedback from the video",
  "fit_verdict": "one of: Size Up, True to Size, Size Down",
  "confidence": "one of: High, Medium, Low"
}

If any field is unclear or not mentioned, use null. Be precise and literal — only extract what was actually said.`;

const verdictColor = (v) => {
  if (v === "Size Up") return "#C9A87C";
  if (v === "Size Down") return "#7C9CA8";
  return "#4CAF7C";
};

const confidenceColor = (c) => {
  if (c === "High") return "#4CAF7C";
  if (c === "Medium") return "#C9A87C";
  return "#E07070";
};

const returnRateColor = (rate) => {
  if (rate >= 40) return "#E07070";
  if (rate >= 20) return "#C9A87C";
  return "#4CAF7C";
};

// Export database to CSV
const exportToCSV = (database) => {
  const headers = ["Brand", "Garment", "Size", "Waist Fit", "Hip Fit", "Length Fit", "Other Issues", "Fit Verdict", "Confidence", "Body Type", "Tryer-Oner", "Returned", "Return Reason", "Raw Feedback", "Date", "Video URL"];
  const rows = database.map(e => [
    e.brand || "", e.garment || "", e.size || "",
    e.waist_fit || "", e.hip_fit || "", e.length_fit || "",
    (e.other_issues || []).join("; "), e.fit_verdict || "",
    e.confidence || "", e.body_type || "", e.tryer_oner || "",
    e.returned === true ? "Yes" : e.returned === false ? "No" : "",
    e.return_reason || "", (e.raw_feedback || "").replace(/,/g, ";"),
    e.created_at ? new Date(e.created_at).toLocaleDateString() : "",
    e.video_url || e.drive_link || ""
  ]);
  const csv = [headers, ...rows].map(r => r.map(cell => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zyze_fit_data_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

function FitForm({ data, onUpdate, onToggleIssue }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Waist", field: "waist_fit", options: FIT_RATINGS },
          { label: "Hip", field: "hip_fit", options: FIT_RATINGS },
          { label: "Length", field: "length_fit", options: LENGTH_RATINGS },
        ].map(({ label, field, options }) => (
          <div className="fit-field" key={field}>
            <div className="fit-field-label">{label}</div>
            <select value={data[field] || ""} onChange={e => onUpdate(field, e.target.value)}>
              <option value="">—</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="section-label">Other Issues</div>
      <div className="issues-grid" style={{ marginBottom: 16 }}>
        {ISSUE_OPTIONS.map(issue => (
          <button key={issue} className={`issue-chip ${(data.other_issues || []).includes(issue) ? "active" : ""}`} onClick={() => onToggleIssue(issue)}>{issue}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {[{ label: "Brand", field: "brand" }, { label: "Garment / Style", field: "garment" }, { label: "Size", field: "size" }, { label: "Tryer-Oner", field: "tryer_oner" }].map(({ label, field }) => (
          <div key={field}>
            <div className="section-label">{label}</div>
            <input className="input-field" value={data[field] || ""} onChange={e => onUpdate(field, e.target.value)} style={{ width: "100%" }} placeholder={field === "tryer_oner" ? "Name or initials..." : ""} />
          </div>
        ))}
        <div>
          <div className="section-label">Body Type</div>
          <div className="fit-field">
            <select value={data.body_type || ""} onChange={e => onUpdate("body_type", e.target.value)} style={{ width: "100%" }}>
              <option value="">—</option>
              <option>Hourglass</option><option>Pear</option><option>Apple</option><option>Rectangle</option><option>Inverted Triangle</option>
            </select>
          </div>
        </div>
        <div>
          <div className="section-label">Verdict</div>
          <div className="fit-field">
            <select value={data.fit_verdict || ""} onChange={e => onUpdate("fit_verdict", e.target.value)} style={{ width: "100%" }}>
              <option value="">—</option>
              <option>Size Up</option><option>True to Size</option><option>Size Down</option>
            </select>
          </div>
        </div>
        <div>
          <div className="section-label">Returned?</div>
          <div className="fit-field">
            <select value={data.returned ?? ""} onChange={e => onUpdate("returned", e.target.value === "" ? null : e.target.value === "true")} style={{ width: "100%" }}>
              <option value="">—</option>
              <option value="false">No — Kept</option>
              <option value="true">Yes — Returned</option>
            </select>
          </div>
        </div>
        <div>
          <div className="section-label">Return Reason</div>
          <div className="fit-field">
            <select value={data.return_reason || ""} onChange={e => onUpdate("return_reason", e.target.value)} style={{ width: "100%" }}>
              <option value="">—</option>
              <option>Too Small</option><option>Too Large</option><option>Poor Quality</option><option>Not as Described</option><option>Style Not Right</option><option>Fit Issue</option>
            </select>
          </div>
        </div>
      </div>

      {data.raw_feedback && (
        <>
          <div className="section-label">Captured Feedback</div>
          <div className="feedback-box" style={{ marginBottom: 16 }}>
            <div className="feedback-quote">"{data.raw_feedback}"</div>
          </div>
        </>
      )}
    </>
  );
}

function AnalyticsTab({ database }) {
  const [filterBrand, setFilterBrand] = useState("All");
  const brands = ["All", ...new Set(database.map(e => e.brand).filter(Boolean))];
  const filtered = filterBrand === "All" ? database : database.filter(e => e.brand === filterBrand);

  const sizeMap = {};
  filtered.forEach(e => {
    if (!e.size) return;
    const key = `${e.brand}__${e.garment}__${e.size}`;
    if (!sizeMap[key]) sizeMap[key] = { brand: e.brand, garment: e.garment, size: e.size, total: 0, returned: 0 };
    sizeMap[key].total++;
    if (e.returned === true) sizeMap[key].returned++;
  });
  const sizeRows = Object.values(sizeMap).sort((a, b) => b.total - a.total);

  const brandMap = {};
  filtered.forEach(e => {
    if (!e.brand) return;
    if (!brandMap[e.brand]) brandMap[e.brand] = { brand: e.brand, total: 0, returned: 0, garments: new Set() };
    brandMap[e.brand].total++;
    if (e.returned === true) brandMap[e.brand].returned++;
    if (e.garment) brandMap[e.brand].garments.add(e.garment);
  });
  const brandRows = Object.values(brandMap).sort((a, b) => b.total - a.total);

  const reasonMap = {};
  filtered.filter(e => e.returned).forEach(e => {
    const r = e.return_reason || "Unknown";
    reasonMap[r] = (reasonMap[r] || 0) + 1;
  });
  const reasonRows = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);

  const totalEntries = filtered.length;
  const totalReturned = filtered.filter(e => e.returned === true).length;
  const overallReturnRate = totalEntries > 0 ? Math.round((totalReturned / totalEntries) * 100) : 0;
  const sizeUpCount = filtered.filter(e => e.fit_verdict === "Size Up").length;
  const sizeUpRate = totalEntries > 0 ? Math.round((sizeUpCount / totalEntries) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {brands.map(b => (
            <button key={b} className={`filter-chip ${filterBrand === b ? "active" : ""}`} onClick={() => setFilterBrand(b)}>{b}</button>
          ))}
        </div>
        <button className="btn-export" onClick={() => exportToCSV(database)}>⬇ Export CSV</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Total Entries", value: totalEntries, color: "#F0EDE8" },
          { label: "Total Returned", value: totalReturned, color: "#E07070" },
          { label: "Return Rate", value: `${overallReturnRate}%`, color: returnRateColor(overallReturnRate) },
          { label: "Size Up Rate", value: `${sizeUpRate}%`, color: "#C9A87C" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 4, padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 300, color, lineHeight: 1, marginBottom: 8 }}>{value}</div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555" }}>{label}</div>
          </div>
        ))}
      </div>

      {brandRows.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 16 }}>Return Rate by Brand</div>
          <div style={{ marginBottom: 32 }}>
            {brandRows.map(row => {
              const rate = row.total > 0 ? Math.round((row.returned / row.total) * 100) : 0;
              return (
                <div key={row.brand} style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 4, padding: "16px 20px", marginBottom: 8, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#C9A87C", minWidth: 100 }}>{row.brand}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 4, background: "#1E1E1E", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${rate}%`, background: returnRateColor(rate), borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, color: returnRateColor(rate), minWidth: 50, textAlign: "right" }}>{rate}%</div>
                  <div style={{ fontSize: 11, color: "#555", minWidth: 80, textAlign: "right" }}>{row.returned}/{row.total} returned</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {sizeRows.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 16 }}>Return Rate by Size</div>
          <div style={{ marginBottom: 32 }}>
            {sizeRows.map((row, i) => {
              const rate = row.total > 0 ? Math.round((row.returned / row.total) * 100) : 0;
              return (
                <div key={i} style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 4, padding: "14px 20px", marginBottom: 4, display: "grid", gridTemplateColumns: "2fr 2fr 1fr 2fr 1fr", gap: 0, alignItems: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C9A87C" }}>{row.brand}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: "#F0EDE8" }}>{row.garment}</div>
                  <div style={{ fontSize: 13, color: "#888" }}>{row.size}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, height: 3, background: "#1E1E1E", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${rate}%`, background: returnRateColor(rate), borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 13, color: returnRateColor(rate), minWidth: 36, textAlign: "right", fontWeight: 500 }}>{rate}%</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#555", textAlign: "right" }}>{row.total}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {reasonRows.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 16 }}>Return Reasons</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 32 }}>
            {reasonRows.map(([reason, count]) => (
              <div key={reason} style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 4, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, color: "#888" }}>{reason}</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 300, color: "#E07070" }}>{count}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {totalEntries === 0 && (
        <div className="empty-state">
          <div className="empty-icon">◎</div>
          <div className="empty-text">No data yet.<br />Start logging try-on entries to see analytics.</div>
        </div>
      )}
    </div>
  );
}

export default function ZyzeQC() {
  const [dbUnlocked, setDbUnlocked] = useState(() => sessionStorage.getItem("zyze_db_auth") === "true");
  const [driveLink, setDriveLink] = useState("");
  const [transcript, setTranscript] = useState("");
  const [stage, setStage] = useState("idle");
  const [edited, setEdited] = useState(null);
  const [database, setDatabase] = useState([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("fit_entries").select("*").order("created_at", { ascending: false });
    if (!error) setDatabase(data || []);
    setLoading(false);
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
  };

  const uploadVideo = async () => {
    if (!videoFile) return null;
    setUploading(true);
    setUploadProgress(10);
    const fileName = `${Date.now()}_${videoFile.name.replace(/\s/g, "_")}`;
    const { data, error } = await supabase.storage.from("tryons").upload(fileName, videoFile, {
      cacheControl: "3600",
      upsert: false,
    });
    setUploadProgress(90);
    if (error) { setError("Video upload failed. Try again."); setUploading(false); return null; }
    const { data: urlData } = supabase.storage.from("tryons").getPublicUrl(fileName);
    setUploadProgress(100);
    setUploading(false);
    return urlData.publicUrl;
  };

  const extractWithAI = async (transcriptText) => {
    setStage("extracting");
    setError("");
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: `Here is the try-on video transcript:\n\n"${transcriptText}"`,
          system: SYSTEM_PROMPT
        }),
      });
      const data = await response.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "{}";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      setEdited({ ...JSON.parse(cleaned) });
      setStage("review");
    } catch (e) {
      setError("AI extraction failed. Try again or check your connection.");
      setStage("idle");
    }
  };

  const handleApprove = async () => {
    let uploadedVideoUrl = null;
    if (videoFile) {
      uploadedVideoUrl = await uploadVideo();
      if (!uploadedVideoUrl) return;
    }
    const entry = {
      brand: edited.brand, garment: edited.garment, size: edited.size,
      waist_fit: edited.waist_fit, hip_fit: edited.hip_fit, length_fit: edited.length_fit,
      other_issues: edited.other_issues || [], raw_feedback: edited.raw_feedback,
      fit_verdict: edited.fit_verdict, confidence: edited.confidence,
      body_type: edited.body_type || null, tryer_oner: edited.tryer_oner || null,
      drive_link: driveLink || null,
      video_url: uploadedVideoUrl || null,
      returned: edited.returned ?? null, return_reason: edited.return_reason || null,
    };
    const { error } = await supabase.from("fit_entries").insert([entry]);
    if (error) { setError("Failed to save. Check your Supabase setup."); return; }
    await fetchEntries();
    setStage("saved");
    setTimeout(() => {
      setStage("idle"); setDriveLink(""); setTranscript(""); setEdited(null);
      setError(""); setVideoFile(null); setVideoURL(""); setUploadProgress(0);
    }, 1800);
  };

  const handleSaveEdit = async () => {
    const { error } = await supabase.from("fit_entries").update({
      brand: editingEntry.brand, garment: editingEntry.garment, size: editingEntry.size,
      waist_fit: editingEntry.waist_fit, hip_fit: editingEntry.hip_fit, length_fit: editingEntry.length_fit,
      other_issues: editingEntry.other_issues || [], raw_feedback: editingEntry.raw_feedback,
      fit_verdict: editingEntry.fit_verdict, confidence: editingEntry.confidence,
      body_type: editingEntry.body_type || null, tryer_oner: editingEntry.tryer_oner || null,
      returned: editingEntry.returned ?? null, return_reason: editingEntry.return_reason || null,
    }).eq("id", editingId);
    if (error) { setError("Failed to update entry."); return; }
    await fetchEntries();
    setEditingId(null); setEditingEntry(null);
    setSaveFlash(true); setTimeout(() => setSaveFlash(false), 2000);
  };

  const handleDeleteEntry = async (id) => {
    await supabase.from("fit_entries").delete().eq("id", id);
    await fetchEntries();
    setDeleteConfirm(null); setEditingId(null); setEditingEntry(null);
  };

  const downloadVideo = (url, name) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "zyze_tryon_video.mp4";
    a.target = "_blank";
    a.click();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .app-shell { max-width: 900px; margin: 0 auto; padding: 40px 20px 80px; }
        .logo { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 300; letter-spacing: 0.3em; text-transform: uppercase; }
        .logo span { color: #C9A87C; font-weight: 600; }
        .pill { font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; background: #1E1E1E; border: 1px solid #2A2A2A; color: #888; padding: 5px 12px; border-radius: 100px; }
        .tabs { display: flex; margin-bottom: 40px; border-bottom: 1px solid #222; }
        .tab { font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: #555; padding: 12px 24px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s; }
        .tab.active { color: #C9A87C; border-bottom-color: #C9A87C; }
        .tab:hover:not(.active) { color: #888; }
        .section-label { font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #555; margin-bottom: 12px; }
        .card { background: #141414; border: 1px solid #1E1E1E; border-radius: 4px; padding: 28px; margin-bottom: 20px; }
        .input-field { background: #0D0D0D; border: 1px solid #2A2A2A; border-radius: 3px; padding: 14px 16px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #F0EDE8; outline: none; transition: border-color 0.2s; width: 100%; }
        .input-field:focus { border-color: #C9A87C; }
        .input-field::placeholder { color: #444; }
        textarea.input-field { resize: vertical; min-height: 120px; line-height: 1.6; }
        .btn-primary { background: #C9A87C; color: #0D0D0D; border: none; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 24px; border-radius: 3px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-primary:hover { background: #D4B98A; }
        .btn-primary:disabled { background: #3A3028; color: #666; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #555; border: 1px solid #2A2A2A; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 12px 20px; border-radius: 3px; cursor: pointer; transition: all 0.2s; }
        .btn-ghost:hover { border-color: #444; color: #888; }
        .btn-approve { background: #1E3A2A; color: #4CAF7C; border: 1px solid #2A5A3A; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; padding: 16px; border-radius: 3px; cursor: pointer; transition: all 0.2s; width: 100%; }
        .btn-approve:hover { background: #24452F; }
        .btn-save { background: #C9A87C; color: #0D0D0D; border: none; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; cursor: pointer; }
        .btn-save:hover { background: #D4B98A; }
        .btn-danger { background: transparent; color: #E07070; border: 1px solid #3A2020; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 10px 16px; border-radius: 3px; cursor: pointer; }
        .btn-danger:hover { background: #2A1414; border-color: #E07070; }
        .btn-export { background: #1A1A1A; color: #C9A87C; border: 1px solid #C9A87C40; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; padding: 8px 16px; border-radius: 3px; cursor: pointer; transition: all 0.2s; }
        .btn-export:hover { background: #2A1E10; }
        .btn-download { background: transparent; color: #7C9CA8; border: 1px solid #7C9CA830; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 12px; border-radius: 3px; cursor: pointer; white-space: nowrap; }
        .btn-download:hover { background: #0D1A1E; border-color: #7C9CA8; }
        .status-bar { display: flex; align-items: center; gap: 10px; padding: 14px 18px; background: #141414; border: 1px solid #1E1E1E; border-radius: 3px; margin-bottom: 20px; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #C9A87C; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .status-text { font-size: 12px; color: #888; }
        .garment-title { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 300; line-height: 1.1; }
        .garment-brand { font-size: 11px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #C9A87C; margin-bottom: 4px; }
        .verdict-badge { padding: 8px 16px; border-radius: 2px; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
        .fit-field { background: #0D0D0D; border: 1px solid #1E1E1E; border-radius: 3px; padding: 16px; }
        .fit-field-label { font-size: 9px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #555; margin-bottom: 8px; }
        .fit-field select { background: transparent; border: none; outline: none; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #F0EDE8; width: 100%; cursor: pointer; }
        .fit-field select option { background: #1a1a1a; }
        .issues-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .issue-chip { padding: 6px 12px; border-radius: 100px; font-size: 11px; cursor: pointer; border: 1px solid #2A2A2A; color: #555; background: transparent; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .issue-chip.active { background: #2A1E10; border-color: #C9A87C; color: #C9A87C; }
        .issue-chip:hover:not(.active) { border-color: #3A3A3A; color: #888; }
        .feedback-box { background: #0D0D0D; border: 1px solid #1E1E1E; border-radius: 3px; padding: 16px; }
        .feedback-quote { font-family: 'Cormorant Garamond', serif; font-size: 16px; font-style: italic; color: #888; line-height: 1.6; }
        .size-compare { display: flex; align-items: center; gap: 16px; padding: 20px; background: #0D0D0D; border: 1px solid #1E1E1E; border-radius: 3px; margin-bottom: 20px; }
        .size-block { text-align: center; flex: 1; }
        .size-number { font-family: 'Cormorant Garamond', serif; font-size: 48px; font-weight: 300; line-height: 1; }
        .size-sub { font-size: 9px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: "#555"; margin-top: 4px; }
        .db-entry { background: #141414; border: 1px solid #1E1E1E; border-radius: 4px; padding: 18px 22px; margin-bottom: 2px; display: flex; align-items: center; gap: 14px; transition: border-color 0.15s; }
        .db-entry:hover { border-color: #2A2A2A; }
        .db-entry.editing { border-color: #C9A87C30; border-bottom-left-radius: 0; border-bottom-right-radius: 0; background: #161410; margin-bottom: 0; }
        .db-brand { font-size: 10px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #C9A87C; min-width: 80px; }
        .db-garment { font-family: 'Cormorant Garamond', serif; font-size: 18px; flex: 1; }
        .db-meta { font-size: 11px; color: #555; min-width: 80px; }
        .db-size { font-size: 13px; color: #777; min-width: 54px; }
        .db-verdict { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border-radius: 100px; white-space: nowrap; }
        .db-returned { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: 100px; white-space: nowrap; }
        .db-edit-btn { font-size: 11px; color: #555; background: transparent; border: 1px solid #2A2A2A; border-radius: 3px; padding: 5px 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; transition: all 0.15s; white-space: nowrap; }
        .db-edit-btn:hover { color: #C9A87C; border-color: #C9A87C40; }
        .edit-panel { background: #141410; border: 1px solid #C9A87C20; border-top: none; border-radius: 0 0 4px 4px; padding: 24px; margin-bottom: 12px; }
        .empty-state { text-align: center; padding: 60px 20px; color: #444; }
        .empty-icon { font-size: 32px; margin-bottom: 16px; }
        .empty-text { font-size: 13px; line-height: 1.8; }
        .success-flash { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: #1E3A2A; border: 1px solid #2A5A3A; border-radius: 3px; color: #4CAF7C; font-size: 13px; font-weight: 500; margin-bottom: 20px; }
        .divider { border: none; border-top: 1px solid #1E1E1E; margin: 20px 0; }
        .helper-text { font-size: 12px; color: #555; line-height: 1.6; margin-top: 10px; }
        .confidence-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .filter-chip { padding: 6px 14px; border-radius: 100px; font-size: 11px; cursor: pointer; border: 1px solid #2A2A2A; color: #555; background: transparent; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .filter-chip.active { background: #1A1A1A; border-color: #C9A87C; color: #C9A87C; }
        .video-upload-zone { border: 2px dashed #2A2A2A; border-radius: 4px; padding: 28px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; }
        .video-upload-zone:hover { border-color: #C9A87C40; background: #141414; }
        .video-preview { width: 100%; border-radius: 4px; margin-bottom: 12px; max-height: 280px; background: #000; }
        .progress-bar { height: 4px; background: #1E1E1E; border-radius: 2px; overflow: hidden; margin-top: 8px; }
        .progress-fill { height: 100%; background: #C9A87C; border-radius: 2px; transition: width 0.3s; }
      `}</style>

      <div className="app-shell">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <div className="logo">ZY<span>ZE</span></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="pill">Fit Intelligence</div>
            {database.length > 0 && <div className="pill" style={{ color: "#C9A87C", borderColor: "#3A2A1A" }}>{database.length} {database.length === 1 ? "entry" : "entries"}</div>}
          </div>
        </div>

        <div className="tabs">
          <div className={`tab ${activeTab === "upload" ? "active" : ""}`} onClick={() => setActiveTab("upload")}>New Entry</div>
          <div className={`tab ${activeTab === "database" ? "active" : ""}`} onClick={() => setActiveTab("database")}>Database {database.length > 0 ? `(${database.length})` : ""}</div>
          <div className={`tab ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")}>Analytics</div>
        </div>

        {/* UPLOAD TAB */}
        {activeTab === "upload" && (
          <>
            {stage === "idle" && (
              <>
                <div className="card">
                  <div className="section-label">Step 1 — Upload Try-On Video</div>

                  {!videoURL ? (
                    <div className="video-upload-zone" onClick={() => fileInputRef.current?.click()}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>
                      <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Tap to upload try-on video from your phone</div>
                      <div style={{ fontSize: 11, color: "#555" }}>MP4, MOV, or any video format</div>
                    </div>
                  ) : (
                    <>
                      <video className="video-preview" src={videoURL} controls />
                      <button className="btn-ghost" style={{ width: "100%", marginBottom: 12 }} onClick={() => { setVideoFile(null); setVideoURL(""); }}>
                        Remove Video
                      </button>
                    </>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: "none" }}
                    onChange={handleVideoSelect}
                  />

                  <div style={{ marginTop: 12 }}>
                    <div className="section-label">Or paste a Google Drive link</div>
                    <input className="input-field" placeholder="https://drive.google.com/..." value={driveLink} onChange={e => setDriveLink(e.target.value)} />
                  </div>
                </div>

                <div className="card">
                  <div className="section-label">Step 2 — Paste Transcript</div>
                  <textarea className="input-field" placeholder="Paste or type what was said in the video — brand, style, size, and all fit feedback..." value={transcript} onChange={e => setTranscript(e.target.value)} style={{ marginBottom: 12 }} />
                  <button className="btn-primary" onClick={async () => { if (transcript.trim()) await extractWithAI(transcript); }} disabled={!transcript.trim()}>
                    Extract Fit Data
                  </button>
                </div>
              </>
            )}

            {stage === "extracting" && <div className="status-bar"><div className="status-dot" /><div className="status-text">AI analyzing fit data...</div></div>}

            {stage === "review" && edited && (
              <>
                <div className="section-label" style={{ marginBottom: 16 }}>QC Review — Confirm Before Approving</div>
                <div className="card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
                    <div>
                      <div className="garment-brand">{edited.brand || "Unknown Brand"}</div>
                      <div className="garment-title">{edited.garment || "Unknown Garment"}</div>
                    </div>
                    <div className="verdict-badge" style={{ background: `${verdictColor(edited.fit_verdict)}15`, color: verdictColor(edited.fit_verdict), border: `1px solid ${verdictColor(edited.fit_verdict)}40` }}>
                      {edited.fit_verdict || "—"}
                    </div>
                  </div>

                  {videoURL && (
                    <div style={{ marginBottom: 20 }}>
                      <div className="section-label">Try-On Video</div>
                      <video className="video-preview" src={videoURL} controls />
                    </div>
                  )}

                  <div className="size-compare">
                    <div className="size-block">
                      <div className="size-number" style={{ color: "#555" }}>{edited.size || "—"}</div>
                      <div className="size-sub">Size Tried</div>
                    </div>
                    <div style={{ color: "#333", fontSize: 24 }}>→</div>
                    <div className="size-block">
                      <div className="size-number" style={{ color: verdictColor(edited.fit_verdict) }}>
                        {edited.fit_verdict === "Size Up" ? "↑" : edited.fit_verdict === "Size Down" ? "↓" : "✓"}
                      </div>
                      <div className="size-sub">Recommendation</div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="confidence-dot" style={{ background: confidenceColor(edited.confidence) }} />
                      <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>{edited.confidence} confidence</span>
                    </div>
                  </div>

                  <FitForm data={edited} onUpdate={(f, v) => setEdited(p => ({ ...p, [f]: v }))} onToggleIssue={(issue) => { const cur = edited.other_issues || []; setEdited(p => ({ ...p, other_issues: cur.includes(issue) ? cur.filter(i => i !== issue) : [...cur, issue] })); }} />

                  {uploading && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="section-label">Uploading Video...</div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
                    </div>
                  )}

                  <hr className="divider" />
                  <button className="btn-approve" onClick={handleApprove} disabled={uploading}>
                    {uploading ? "Uploading..." : "✓ Approve & Save to Database"}
                  </button>
                </div>
              </>
            )}

            {stage === "saved" && <div className="success-flash"><span>✓</span><span>Fit entry saved to database</span></div>}
            {error && <div style={{ padding: 16, background: "#2A1414", border: "1px solid #5A2A2A", borderRadius: 3, color: "#E07070", fontSize: 13, marginTop: 12 }}>{error}</div>}
          </>
        )}

        {/* DATABASE TAB */}
        {activeTab === "database" && (
          <>
            {!dbUnlocked ? (
              <DatabasePasswordGate onUnlock={() => setDbUnlocked(true)} />
            ) : (
              <>
            {saveFlash && <div className="success-flash"><span>✓</span><span>Entry updated</span></div>}

            {database.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <button className="btn-export" onClick={() => exportToCSV(database)}>⬇ Export All as CSV</button>
              </div>
            )}

            {loading ? (
              <div className="status-bar"><div className="status-dot" /><div className="status-text">Loading database...</div></div>
            ) : database.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◎</div>
                <div className="empty-text">No fit entries yet.<br />Approve your first try-on to start building your database.</div>
              </div>
            ) : (
              <>
                <div className="section-label" style={{ marginBottom: 16 }}>{database.length} Fit {database.length === 1 ? "Entry" : "Entries"}</div>
                {database.map(entry => (
                  <div key={entry.id}>
                    <div className={`db-entry ${editingId === entry.id ? "editing" : ""}`}>
                      <div className="db-brand">{entry.brand}</div>
                      <div className="db-garment">{entry.garment}</div>
                      <div className="db-size">Size {entry.size}</div>
                      {entry.body_type && <div className="db-meta">{entry.body_type}</div>}
                      {entry.tryer_oner && <div className="db-meta">{entry.tryer_oner}</div>}
                      <div className="db-verdict" style={{ background: `${verdictColor(entry.fit_verdict)}15`, color: verdictColor(entry.fit_verdict), border: `1px solid ${verdictColor(entry.fit_verdict)}30` }}>{entry.fit_verdict}</div>
                      {entry.returned !== null && entry.returned !== undefined && (
                        <div className="db-returned" style={{ background: entry.returned ? "#2A1414" : "#1E3A2A", color: entry.returned ? "#E07070" : "#4CAF7C", border: `1px solid ${entry.returned ? "#3A2020" : "#2A5A3A"}` }}>
                          {entry.returned ? "Returned" : "Kept"}
                        </div>
                      )}
                      {entry.video_url && (
                        <button className="btn-download" onClick={() => downloadVideo(entry.video_url, `${entry.brand}_${entry.garment}_${entry.size}.mp4`)}>
                          ⬇ Video
                        </button>
                      )}
                      <button className="db-edit-btn" onClick={() => { if (editingId === entry.id) { setEditingId(null); setEditingEntry(null); setDeleteConfirm(null); } else { setEditingId(entry.id); setEditingEntry({ ...entry }); setDeleteConfirm(null); } }}>
                        {editingId === entry.id ? "Close" : "Edit"}
                      </button>
                    </div>

                    {editingId === entry.id && editingEntry && (
                      <div className="edit-panel">
                        <div className="section-label" style={{ marginBottom: 16 }}>Editing — {editingEntry.brand} {editingEntry.garment}</div>
                        {editingEntry.video_url && (
                          <div style={{ marginBottom: 20 }}>
                            <div className="section-label">Try-On Video</div>
                            <video className="video-preview" src={editingEntry.video_url} controls />
                            <button className="btn-download" style={{ marginTop: 8 }} onClick={() => downloadVideo(editingEntry.video_url, `${editingEntry.brand}_${editingEntry.garment}.mp4`)}>
                              ⬇ Download Video
                            </button>
                          </div>
                        )}
                        <FitForm data={editingEntry} onUpdate={(f, v) => setEditingEntry(p => ({ ...p, [f]: v }))} onToggleIssue={(issue) => { const cur = editingEntry.other_issues || []; setEditingEntry(p => ({ ...p, other_issues: cur.includes(issue) ? cur.filter(i => i !== issue) : [...cur, issue] })); }} />
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <button className="btn-save" onClick={handleSaveEdit}>Save Changes</button>
                          <button className="btn-ghost" onClick={() => { setEditingId(null); setEditingEntry(null); setDeleteConfirm(null); }}>Cancel</button>
                          <button className="btn-danger" onClick={() => setDeleteConfirm(entry.id)}>Delete Entry</button>
                        </div>
                        {deleteConfirm === entry.id && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#1A0D0D", border: "1px solid #3A1A1A", borderRadius: 3, marginTop: 12 }}>
                            <div style={{ fontSize: 12, color: "#E07070", flex: 1 }}>Delete this entry permanently?</div>
                            <button className="btn-danger" onClick={() => handleDeleteEntry(entry.id)}>Yes, Delete</button>
                            <button className="btn-ghost" style={{ padding: "8px 14px" }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
            </>
            )}
          </>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && <AnalyticsTab database={database} />}
      </div>
    </div>
  );
}
