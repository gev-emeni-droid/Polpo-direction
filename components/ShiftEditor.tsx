
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Palette, ChevronDown } from 'lucide-react';
import { Shift, ShiftSegment, ABSENCE_TYPES, ShiftServiceType, Template } from '../types';
import { getTemplates } from '../services/storage';

interface ShiftEditorProps {
  shift: Shift;
  employeeName: string;
  employeeRoleId: string; 
  onSave: (updated: Shift) => void;
  onBatchSave?: (dates: string[], shift: Shift) => void; 
  onClose: () => void;
  position: { x: number, y: number };
  currentDate: string;
}

const PASTEL_COLORS = [
  '#cbd5e1', // Slate
  '#fca5a5', // Red
  '#fdba74', // Orange
  '#fde047', // Yellow
  '#86efac', // Green
  '#67e8f9', // Cyan
  '#93c5fd', // Blue
  '#c4b5fd', // Violet
  '#f0abfc', // Fuchsia
  '#ffffff', // Reset
];

const ShiftEditor: React.FC<ShiftEditorProps> = ({ shift, employeeName, employeeRoleId, onSave, onBatchSave, onClose, position, currentDate }) => {
  const [segments, setSegments] = useState<ShiftSegment[]>(shift.segments && shift.segments.length > 0 ? shift.segments : [{type: 'horaire', start: '10:00', end: '15:00'}]);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [openPaletteIndex, setOpenPaletteIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const allTemplates = await getTemplates();
        const filtered = (Array.isArray(allTemplates) ? allTemplates : []).filter(t => t.role === 'GÉNÉRAL' || t.role === employeeRoleId);
        setAvailableTemplates(filtered);

        const currentTplId = segments.find(s => s.type === 'horaire')?.templateId;
        if (currentTplId) {
            setSelectedTemplateId(currentTplId);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
        setAvailableTemplates([]);
      }
    };
    loadTemplates();
  }, [employeeRoleId]);

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const tplId = e.target.value;
      setSelectedTemplateId(tplId);

      if (!tplId) return;

      const tpl = availableTemplates.find(t => t.id === tplId);
      if (tpl) {
          const newSegments: ShiftSegment[] = tpl.slots.map(slot => ({
              type: 'horaire',
              start: slot.start,
              end: slot.end,
              templateId: tpl.id,
              hasOverride: false,
          }));
          setSegments(newSegments);
      }
  };

  const handleUpdateSegment = (index: number, field: keyof ShiftSegment, value: any) => {
    const newSegments = [...segments];
    let overrideFlag = newSegments[index].hasOverride;

    if ((field === 'start' || field === 'end') && newSegments[index].templateId) {
        overrideFlag = true;
    }

    newSegments[index] = { 
        ...newSegments[index], 
        [field]: value,
        hasOverride: overrideFlag
    };
    
    if (field === 'type' && value === 'code') {
        if (!newSegments[index].label) newSegments[index].label = 'REPOS';
        delete newSegments[index].start;
        delete newSegments[index].end;
        delete newSegments[index].templateId;
        delete newSegments[index].hasOverride; 
        delete newSegments[index].colorOverride;
        setSelectedTemplateId(''); 
    } 
    if (field === 'type' && value === 'horaire') {
        if (!newSegments[index].start) newSegments[index].start = '10:00';
        if (!newSegments[index].end) newSegments[index].end = '15:00';
    }

    setSegments(newSegments);
  };

  const handleAddSegment = () => {
      setSegments([...segments, { type: 'horaire', start: '18:00', end: '23:00' }]);
  };

  const handleRemoveSegment = (index: number) => {
      setSegments(segments.filter((_, i) => i !== index));
      setOpenPaletteIndex(null);
  };

  // Helper to build shift object
  const buildShift = (segs: ShiftSegment[]): Shift => {
      let serviceType: ShiftServiceType = 'none';
      const hasMidi = segs.some(s => s.type === 'horaire' && s.start && s.start < "16:00");
      const hasSoir = segs.some(s => s.type === 'horaire' && s.end && s.end >= "16:00");
      
      if (hasMidi && hasSoir) serviceType = 'midi+soir';
      else if (hasMidi) serviceType = 'midi';
      else if (hasSoir) serviceType = 'soir';

      const mainType = segs.every(s => s.type === 'code' && s.label === 'REPOS') ? 'repos' : 
                       segs.every(s => s.type === 'code' && ABSENCE_TYPES.includes(s.label as any)) ? 'absence' : 'travail';

      return {
          ...shift, 
          type: mainType,
          serviceType,
          segments: segs
      };
  };

  const handleSave = () => {
    onSave(buildShift(segments));
    onClose();
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    top: position.y,
    left: Math.min(position.x, window.innerWidth - 320),
    zIndex: 50
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose}></div>
      <div style={style} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-80 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-100">
        <div className="p-4 border-b flex justify-between items-center shrink-0 bg-slate-50 rounded-t-xl">
            <h4 className="font-bold text-slate-800 truncate pr-2">{employeeName}</h4>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar">
            {/* Template Selector */}
            <div className="mb-4">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Modèle horaire</label>
                <div className="relative">
                    <select
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm appearance-none bg-white focus:ring-2 focus:ring-blue-500 outline-none pr-8"
                        value={selectedTemplateId}
                        onChange={handleTemplateSelect}
                    >
                        <option value="">-- Choisir un modèle --</option>
                        {availableTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>
            
            <div className="space-y-3 mb-4">
            {segments.map((seg, idx) => {
                let previewBg = '#fff';
                let previewColor = '#334155';
                let borderColor = 'transparent';

                if (seg.type === 'code') {
                    if(seg.label === 'REPOS') { previewBg = '#000000'; previewColor = '#FFFFFF'; }
                    else if (seg.label === 'Ecole') { previewBg = '#EFEBE9'; previewColor = '#5D4037'; borderColor='#D7CCC8'; }
                    else if(ABSENCE_TYPES.includes(seg.label as any)) { previewBg = '#FFEBEE'; previewColor = '#D32F2F'; borderColor='#FECACA'; }
                } else if (seg.type === 'horaire') {
                    if (seg.colorOverride) previewBg = seg.colorOverride;
                    else if (seg.templateId) {
                        const tpl = availableTemplates.find(t => t.id === seg.templateId);
                        if (tpl && tpl.color) previewBg = tpl.color;
                    }
                    if (previewBg === '#fff' || previewBg === '#ffffff') borderColor = '#e2e8f0';
                }
                
                return (
                <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200 relative" style={{ borderColor: borderColor !== 'transparent' ? borderColor : undefined }}>
                    <button onClick={() => handleRemoveSegment(idx)} className="absolute top-1 right-1 text-slate-400 hover:text-red-500"><X size={14} /></button>

                    <div className="flex mb-2 gap-2 pr-6">
                        <button 
                        className={`flex-1 text-[10px] py-1 rounded font-bold ${seg.type === 'horaire' ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500 border'}`}
                        onClick={() => handleUpdateSegment(idx, 'type', 'horaire')}
                        >
                            HORAIRE
                        </button>
                        <button 
                        className={`flex-1 text-[10px] py-1 rounded font-bold ${seg.type === 'code' ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500 border'}`}
                        onClick={() => handleUpdateSegment(idx, 'type', 'code')}
                        >
                            CODE
                        </button>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        {seg.type === 'horaire' ? (
                            <>
                                <input type="time" value={seg.start} onChange={e => handleUpdateSegment(idx, 'start', e.target.value)} className="flex-1 text-sm border rounded px-1 py-1 text-center"/>
                                <span className="text-slate-400">-</span>
                                <input type="time" value={seg.end} onChange={e => handleUpdateSegment(idx, 'end', e.target.value)} className="flex-1 text-sm border rounded px-1 py-1 text-center"/>
                            </>
                        ) : (
                            <div className="w-full">
                                <select 
                                value={seg.label}
                                onChange={e => handleUpdateSegment(idx, 'label', e.target.value)}
                                className="w-full text-sm border rounded px-2 py-1 font-bold"
                                style={{ backgroundColor: previewBg, color: previewColor }}
                                >
                                    <option value="REPOS">REPOS</option>
                                    <option value="Ecole">Ecole</option>
                                    <optgroup label="Absences">
                                        {ABSENCE_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        )}
                    </div>

                    {seg.type === 'horaire' && (
                        <div className="relative">
                            <button 
                            onClick={() => setOpenPaletteIndex(openPaletteIndex === idx ? null : idx)}
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded w-full"
                            >
                                <div className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: seg.colorOverride || previewBg }}></div>
                                <span>{seg.colorOverride ? 'Couleur personnalisée' : 'Couleur par défaut'}</span>
                                <Palette size={12} className="ml-auto" />
                            </button>
                            {openPaletteIndex === idx && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 shadow-lg rounded p-2 z-10">
                                    <div className="grid grid-cols-5 gap-1 mb-2">
                                        {PASTEL_COLORS.filter(c => c !== '#ffffff').map(c => (
                                            <button key={c} onClick={() => { handleUpdateSegment(idx, 'colorOverride', c); setOpenPaletteIndex(null); }} className="w-6 h-6 rounded-full border border-slate-100 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                    <button onClick={() => { handleUpdateSegment(idx, 'colorOverride', undefined); setOpenPaletteIndex(null); }} className="w-full text-xs py-1 px-2 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">Réinitialiser</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )})}
            </div>

            <button onClick={handleAddSegment} className="w-full mb-4 py-1.5 border border-dashed border-slate-300 rounded text-slate-500 text-xs font-medium hover:bg-slate-50 flex items-center justify-center gap-1">
                <Plus size={12} /> Ajouter un segment
            </button>
        </div>

        <div className="p-4 border-t bg-slate-50 rounded-b-xl">
            <button onClick={handleSave} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
                Valider pour ce jour
            </button>
        </div>
      </div>
    </>
  );
};

export default ShiftEditor;
