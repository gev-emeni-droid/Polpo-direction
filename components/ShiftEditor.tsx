import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Palette, ChevronDown } from 'lucide-react';
import { Shift, ShiftSegment, ABSENCE_TYPES, ShiftServiceType, Template } from '../types';
import { getTemplates } from '../services/storage';

interface ShiftEditorProps {
  shift: Shift;
  employeeName: string;
  employeeRoleId: string; // To filter templates
  position: { x: number, y: number };
  templates?: Template[];
  availableTemplates: Template[];
  onSave: (updated: Shift) => void;
  onClose: () => void;
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

const ShiftEditor: React.FC<ShiftEditorProps> = ({ shift, employeeName, employeeRoleId, onSave, onClose, position }) => {
  const [segments, setSegments] = useState<ShiftSegment[]>(shift.segments && shift.segments.length > 0 ? shift.segments : [{type: 'horaire', start: '10:00', end: '15:00'}]);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  // Track which segment is currently opening the color palette
  const [openPaletteIndex, setOpenPaletteIndex] = useState<number | null>(null);

  useEffect(() => {
    // Load and filter templates
    const loadTemplates = async () => {
      try {
        const allTemplates = await getTemplates();
        const filtered = allTemplates.filter(t => t.role === 'GÉNÉRAL' || t.role === employeeRoleId);
        setAvailableTemplates(filtered);

        // Try to determine current template from segments
        // If the first segment has a templateId, we assume the day is based on that template
        const currentTplId = segments.find(s => s.type === 'horaire')?.templateId;
        if (currentTplId) {
            setSelectedTemplateId(currentTplId);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
        setAvailableTemplates([]);
      }
    };
    
    loadTemplates();
  }, [employeeRoleId]); // Re-run if role changes (though editor usually unmounts)

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const tplId = e.target.value;
      setSelectedTemplateId(tplId);

      if (!tplId) return;

      const tpl = availableTemplates.find(t => t.id === tplId);
      if (tpl) {
          // Replace segments with template slots
          const newSegments: ShiftSegment[] = tpl.slots.map(slot => ({
              type: 'horaire',
              start: slot.start,
              end: slot.end,
              templateId: tpl.id,
              hasOverride: false, // Clean state
              // We do not set colorOverride, so it picks up template default color in View
          }));
          setSegments(newSegments);
      }
  };

  const handleUpdateSegment = (index: number, field: keyof ShiftSegment, value: any) => {
    const newSegments = [...segments];
    let overrideFlag = newSegments[index].hasOverride;

    // If changing times on a template-linked segment, mark as override
    if ((field === 'start' || field === 'end') && newSegments[index].templateId) {
        overrideFlag = true;
    }

    newSegments[index] = { 
        ...newSegments[index], 
        [field]: value,
        hasOverride: overrideFlag
    };
    
    // If switching to code 'REPOS', clear times
    if (field === 'type' && value === 'code') {
        if (!newSegments[index].label) newSegments[index].label = 'REPOS';
        delete newSegments[index].start;
        delete newSegments[index].end;
        // Also remove templateId if it becomes a code
        delete newSegments[index].templateId;
        delete newSegments[index].hasOverride; 
        delete newSegments[index].colorOverride;
        
        // Reset top selector if we go full manual/code
        setSelectedTemplateId(''); 
    } 
    // If switching to horaire, add defaults
    if (field === 'type' && value === 'horaire') {
        if (!newSegments[index].start) newSegments[index].start = '10:00';
        if (!newSegments[index].end) newSegments[index].end = '15:00';
    }

    setSegments(newSegments);
  };

  const handleAddSegment = () => {
      setSegments([...segments, { type: 'horaire', start: '18:00', end: '23:00' }]);
      // Adding a manual segment breaks strict adherence to a template usually, 
      // but we leave templateId on others. 
  };

  const handleRemoveSegment = (index: number) => {
      setSegments(segments.filter((_, i) => i !== index));
      setOpenPaletteIndex(null);
  };

  const handleSave = () => {
    // Determine overall shift stats
    let serviceType: ShiftServiceType = 'none';
    const hasMidi = segments.some(s => s.type === 'horaire' && s.start && s.start < "16:00");
    const hasSoir = segments.some(s => s.type === 'horaire' && s.end && s.end >= "16:00");
    
    if (hasMidi && hasSoir) serviceType = 'midi+soir';
    else if (hasMidi) serviceType = 'midi';
    else if (hasSoir) serviceType = 'soir';

    // Simple heuristic for main type
    const mainType = segments.every(s => s.type === 'code' && s.label === 'REPOS') ? 'repos' : 
                     segments.every(s => s.type === 'code' && ABSENCE_TYPES.includes(s.label as any)) ? 'absence' : 'travail';

    onSave({
      ...shift,
      type: mainType,
      serviceType,
      segments
    });
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
      <div style={style} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-80 p-4 animate-in fade-in zoom-in-95 duration-100 origin-top-left flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-3 border-b pb-2 shrink-0">
            <h4 className="font-bold text-slate-800 truncate pr-2">{employeeName}</h4>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
        </div>

        {/* Template Selector */}
        <div className="mb-4 shrink-0">
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
        
        <div className="space-y-3 overflow-y-auto pr-1 pb-2 flex-1 custom-scrollbar">
           {segments.map((seg, idx) => {
             // Preview Color logic identical to view
             let previewBg = '#fff';
             let previewColor = '#334155';
             let borderColor = 'transparent';

             if (seg.type === 'code') {
                 if(seg.label === 'REPOS') { previewBg = '#000000'; previewColor = '#FFFFFF'; }
                 else if(ABSENCE_TYPES.includes(seg.label as any)) { previewBg = '#FFEBEE'; previewColor = '#D32F2F'; borderColor='#FECACA'; }
             } else if (seg.type === 'horaire') {
                 if (seg.colorOverride) previewBg = seg.colorOverride;
                 else if (seg.templateId) {
                     const tpl = availableTemplates.find(t => t.id === seg.templateId); // Using availableTemplates (subset) is safe as usually we have the role loaded
                     if (tpl && tpl.color) previewBg = tpl.color;
                 }
                 // If no color, default visual
                 if (previewBg === '#fff' || previewBg === '#ffffff') borderColor = '#e2e8f0';
             }
             
             return (
             <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200 relative" style={{ borderColor: borderColor !== 'transparent' ? borderColor : undefined }}>
                 {/* Remove Button */}
                 <button onClick={() => handleRemoveSegment(idx)} className="absolute top-1 right-1 text-slate-400 hover:text-red-500">
                    <X size={14} />
                 </button>

                 {/* Type Selector */}
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

                 {/* Inputs */}
                 <div className="flex items-center gap-2 mb-2">
                     {seg.type === 'horaire' ? (
                        <>
                            <input 
                              type="time" 
                              value={seg.start} 
                              onChange={e => handleUpdateSegment(idx, 'start', e.target.value)}
                              className="flex-1 text-sm border rounded px-1 py-1 text-center"
                            />
                            <span className="text-slate-400">-</span>
                            <input 
                              type="time" 
                              value={seg.end} 
                              onChange={e => handleUpdateSegment(idx, 'end', e.target.value)}
                              className="flex-1 text-sm border rounded px-1 py-1 text-center"
                            />
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
                                <optgroup label="Absences">
                                    {ABSENCE_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                                </optgroup>
                             </select>
                         </div>
                     )}
                 </div>

                 {/* Color Picker (Only for Horaire) */}
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
                                        <button
                                            key={c}
                                            onClick={() => {
                                                handleUpdateSegment(idx, 'colorOverride', c);
                                                setOpenPaletteIndex(null);
                                            }}
                                            className="w-6 h-6 rounded-full border border-slate-100 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                                <button 
                                  onClick={() => {
                                      handleUpdateSegment(idx, 'colorOverride', undefined);
                                      setOpenPaletteIndex(null);
                                  }}
                                  className="w-full text-xs py-1 px-2 border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                                >
                                  Réinitialiser la couleur
                                </button>
                            </div>
                        )}
                     </div>
                 )}
             </div>
           )})}
        </div>

        <button 
          onClick={handleAddSegment}
          className="w-full mt-2 py-1.5 border border-dashed border-slate-300 rounded text-slate-500 text-xs font-medium hover:bg-slate-50 flex items-center justify-center gap-1 shrink-0"
        >
           <Plus size={12} /> Ajouter un segment
        </button>

        <button 
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 mt-4 shrink-0"
        >
          Valider
        </button>
      </div>
    </>
  );
};

export default ShiftEditor;
