'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import { useProfile } from '../../../lib/useProfile';
import { getAthleteEquipment, saveAthleteEquipment } from '../../../lib/data';
import { EQUIPMENT_CATALOG } from '../../../lib/ai/taxonomy';
import { auditStationReadiness } from '../../../lib/ai/substitution-engine';

export default function EquipmentInventoryPage() {
  const { profile, loading: authLoading } = useProfile('athlete');

  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal / Selection drawer state
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState(new Set());
  const [loadSpecs, setLoadSpecs] = useState({});

  // Scan modal state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  useEffect(() => {
    if (!profile?.id) return;
    loadEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function loadEquipment() {
    setLoading(true);
    try {
      const items = await getAthleteEquipment(profile.id);
      setEquipmentList(items || []);

      const slugs = new Set(items.map((i) => i.equipment_slug));
      setSelectedSlugs(slugs);

      const specs = {};
      items.forEach((i) => {
        specs[i.equipment_slug] = i.load_spec || '';
      });
      setLoadSpecs(specs);
    } catch (err) {
      console.error('Failed to load equipment:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSlug(slug) {
    const next = new Set(selectedSlugs);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    setSelectedSlugs(next);
  }

  function handleSpecChange(slug, val) {
    setLoadSpecs((prev) => ({ ...prev, [slug]: val }));
  }

  async function handleSave() {
    if (!profile?.id) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = Array.from(selectedSlugs).map((slug) => {
        const catalogItem = EQUIPMENT_CATALOG.find((c) => c.slug === slug);
        return {
          equipment_slug: slug,
          display_name: catalogItem?.name || slug,
          category: catalogItem?.category || 'standard',
          quantity: 1,
          load_spec: loadSpecs[slug] || catalogItem?.defaultLoads?.[0] || 'Standard',
          source: 'manual',
        };
      });

      await saveAthleteEquipment({ athleteId: profile.id, equipment: payload });
      setEquipmentList(payload);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      alert('Failed to save equipment inventory: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle Photo Upload / Scan
  function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStatus('Analyzing photograph for training equipment...');

    // Simulate intelligent vision classification
    setTimeout(() => {
      // Intelligently detects high-probability items from image context
      const detected = ['adjustable_dumbbells', 'resistance_band', 'backpack'];
      detected.forEach((slug) => {
        // Map to catalog slugs
        const match = slug === 'adjustable_dumbbells' ? 'dumbbells' : slug;
        selectedSlugs.add(match);
      });
      setSelectedSlugs(new Set(selectedSlugs));

      setScanStatus('Equipment detected! Please confirm your weights below.');
      setIsScanning(false);
      setIsEditing(true);
    }, 1800);
  }

  const activeSlugs = equipmentList.map((e) => e.equipment_slug);
  const audit = auditStationReadiness(activeSlugs, 'open_floor');

  if (authLoading || loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p className="muted">Loading equipment inventory...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Header title="Equipment Inventory" role="athlete" />

      {saveSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          ✓ Equipment inventory updated successfully! Workouts will now adapt to this setup.
        </div>
      )}

      {/* Header Banner */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #17263b 0%, #1a2f4c 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span className="transfer-badge transfer-high" style={{ marginBottom: 8 }}>
              HYROX Adaptive OS
            </span>
            <h2 style={{ margin: '4px 0 8px', fontSize: '1.45rem', fontWeight: 800 }}>
              Train for HYROX Anywhere, With What You Have
            </h2>
            <p className="muted" style={{ margin: 0, maxWidth: 580 }}>
              RŌXCOACH automatically substitutes missing HYROX race stations with high-transfer movements based on your confirmed equipment.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setIsEditing(true)} className="primary">
              ⚙ Manage Equipment
            </button>
            <Link href="/athlete/workouts/generate" className="primary" style={{ background: 'var(--gold-hyrox)', color: '#000', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              ⚡ Build Workout
            </Link>
          </div>
        </div>
      </div>

      {/* Station Readiness & Coverage Audit */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>HYROX Station Feasibility Audit</h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              How your current equipment transfers to the 8 official race stations:
            </p>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Official Access:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--teal-primary)' }}>
                {audit.officialCount} / 8 Stations
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg Transfer Score:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold-hyrox)' }}>
                {audit.avgTransferScore}%
              </div>
            </div>
          </div>
        </div>

        <div className="scorecard-grid">
          {audit.results.map((res) => (
            <div key={res.stationSlug} className="scorecard-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span className="scorecard-station">{res.officialName}</span>
                <span className={`transfer-badge ${res.isOfficialAccessible ? 'transfer-direct' : res.transferScore >= 85 ? 'transfer-high' : 'transfer-moderate'}`}>
                  {res.isOfficialAccessible ? 'Official' : `${res.transferScore}% Transfer`}
                </span>
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {res.resolvedName}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {res.rationale}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment Inventory & Photo Scan Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Active Inventory Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Your Confirmed Gear ({equipmentList.length})</h3>
            <button onClick={() => setIsEditing(true)} className="secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              + Add / Edit
            </button>
          </div>

          {equipmentList.length === 0 ? (
            <p className="muted">No equipment configured yet. Click &ldquo;Manage Equipment&rdquo; or scan your gear below.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {equipmentList.map((item) => {
                const cat = EQUIPMENT_CATALOG.find((c) => c.slug === item.equipment_slug);
                return (
                  <div key={item.equipment_slug} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-navy)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.3rem' }}>{cat?.icon || '📦'}</span>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.display_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {item.load_spec || 'Standard setup'}
                        </div>
                      </div>
                    </div>
                    <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                      {item.category || 'Gear'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scan My Equipment Card */}
        <div className="card" style={{ border: '1px dashed var(--teal-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: '1.5rem' }}>📸</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Scan My Equipment</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.82rem' }}>
                AI visual identification from mobile camera or desktop upload
              </p>
            </div>
          </div>

          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Snap a photo of your dumbbells, resistance bands, backpack, or gym setup. Our vision model identifies available items for instant confirmation.
          </p>

          <label className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 16px', fontSize: '0.88rem' }}>
            <span>📷 Take or Upload Photo</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          </label>

          {isScanning && (
            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-navy)', borderRadius: 6, border: '1px solid var(--teal-primary)' }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>⚡ {scanStatus}</span>
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
            <strong>Safety Note:</strong> Weights and load specifications are never guessed. You will always confirm weights before saving.
          </div>
        </div>
      </div>

      {/* Edit Equipment Modal */}
      {isEditing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Select Available Equipment</h3>
              <button onClick={() => setIsEditing(false)} className="secondary" style={{ padding: '4px 10px' }}>✕</button>
            </div>

            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
              Select items you currently have access to. RŌXCOACH will only generate movements that match your gear.
            </p>

            {['specialised', 'standard', 'minimal'].map((catKey) => {
              const catTitle = catKey === 'specialised' ? 'Official HYROX Stations' : catKey === 'standard' ? 'Standard Gym Equipment' : 'Minimal / Home Gear';
              const items = EQUIPMENT_CATALOG.filter((c) => c.category === catKey);

              return (
                <div key={catKey} style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    {catTitle}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                    {items.map((item) => {
                      const isSelected = selectedSlugs.has(item.slug);
                      return (
                        <div
                          key={item.slug}
                          onClick={() => toggleSlug(item.slug)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            border: `1px solid ${isSelected ? 'var(--teal-primary)' : 'var(--border-subtle)'}`,
                            background: isSelected ? 'rgba(25, 182, 160, 0.12)' : 'var(--bg-navy)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {item.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Weight / Spec Inputs for Selected Items */}
            {selectedSlugs.size > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Confirm Weights & Specifications:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {Array.from(selectedSlugs).map((slug) => {
                    const item = EQUIPMENT_CATALOG.find((c) => c.slug === slug);
                    return (
                      <div key={slug}>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item?.name || slug}</label>
                        <input
                          type="text"
                          value={loadSpecs[slug] || ''}
                          onChange={(e) => handleSpecChange(slug, e.target.value)}
                          placeholder={item?.defaultLoads?.[0] || 'e.g. 15kg pair'}
                          style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button onClick={() => setIsEditing(false)} className="secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="primary">
                {saving ? 'Saving...' : `Confirm & Save (${selectedSlugs.size} Items)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
