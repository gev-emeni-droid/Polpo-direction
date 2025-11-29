
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Settings, Users, Download, Plus, Search, ArrowLeft, Edit2 } from 'lucide-react';
import { getPlannings, updatePlanning, getTemplates, getRoles } from '../services/storage';
import { Planning, PlanningRow, Shift, Template, ExtraShift, ABSENCE_TYPES } from '../types';
import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import ShiftEditor from '../components/ShiftEditor';
import SettingsModal from '../components/SettingsModal';
import AddShiftModal from '../components/AddShiftModal';
import EditEmployeeModal from '../components/EditEmployeeModal';
import ExportModal from '../components/ExportModal';
import { generatePDF } from '../services/pdfService';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const PlanningView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [viewMode, setViewMode] = useState<'SEMAINE' | 'JOUR'>('SEMAINE');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // 0 = Monday
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Employee State
  const [editingEmployee, setEditingEmployee] = useState<{id: string, name: string, role: string} | null>(null);

  // Accordion State: Set of collapsed role names
  const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(new Set());
  
  // Editor State - Updated to include employeeRole
  const [editingShift, setEditingShift] = useState<{shift: Shift, employeeId: string, employeeName: string, employeeRole: string, date: string} | null>(null);
  const [editorPos, setEditorPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const loadPlanningData = async () => {
      if (id) {
        try {
          const all = await getPlannings();
          const p = all.find(x => x.id === id);
          if (p) setPlanning(p);
          else navigate('/'); 
        } catch (error) {
          console.error('Failed to load planning:', error);
          navigate('/');
        }
      }
      // Load templates for colors
      try {
        const templateList = await getTemplates();
        setTemplates(templateList);
      } catch (error) {
        console.error('Failed to load templates:', error);
        setTemplates([]);
      }
    };

    loadPlanningData();
  }, [id, navigate, isSettingsOpen, editingEmployee]); 

  const savePlanning = (updated: Planning) => {
    updatePlanning(updated);
    setPlanning(updated);
  };

  const handleShiftUpdate = (updatedShift: Shift) => {
    if (!planning || !editingShift) return;
    
    // Note: Override logic is handled inside ShiftEditor now, we just save what it gives back
    const newRows = planning.rows.map(row => {
      if (row.employeeId === editingShift.employeeId) {
        return {
          ...row,
          shifts: {
            ...row.shifts,
            [editingShift.date]: updatedShift
          }
        };
      }
      return row;
    });

    savePlanning({ ...planning, rows: newRows });
  };

  const handleAddShiftData = (data: { 
    employeeId: string; 
    employeeName: string; 
    employeeRole: string; 
    isExtra: boolean;
    date: string;
    shift: Shift;
    extraCount?: number;
    extraType?: "Hôtesse LBE" | "Brigad Plage" | "Agent de sécurité";
  }) => {
    if (!planning) return;

    if (data.isExtra) {
        // --- EXTRA LOGIC: Add to extraShifts array with count and type ---
        // Extract start/end from the first segment
        const segment = data.shift.segments.find(s => s.type === 'horaire');
        if (segment && segment.start && segment.end) {
            const newExtra: ExtraShift = {
                id: crypto.randomUUID(),
                planningId: planning.id,
                label: data.extraType || "Hôtesse LBE", // Use the type from modal or default
                date: data.date,
                start: segment.start,
                end: segment.end,
                count: data.extraCount || 1
            };
            
            savePlanning({
                ...planning,
                extraShifts: [...(planning.extraShifts || []), newExtra]
            });
        }
    } else {
        // --- EMPLOYEE LOGIC: Create/Update Row ---
        let updatedRows = [...planning.rows];
        const existingRowIndex = updatedRows.findIndex(r => r.employeeId === data.employeeId);

        if (existingRowIndex !== -1) {
            updatedRows[existingRowIndex] = {
                ...updatedRows[existingRowIndex],
                shifts: {
                ...updatedRows[existingRowIndex].shifts,
                [data.date]: data.shift
                }
            };
        } else {
            const newRow: PlanningRow = {
                employeeId: data.employeeId,
                employeeName: data.employeeName,
                employeeRole: data.employeeRole,
                isExtra: data.isExtra,
                shifts: {}
            };
            const start = parseISO(planning.weekStart);
            for(let i=0; i<7; i++) {
                const d = format(addDays(start, i), 'yyyy-MM-dd');
                newRow.shifts[d] = { date: d, type: 'repos', serviceType: 'none', segments: [{type: 'code', label: 'REPOS'}] };
            }
            newRow.shifts[data.date] = data.shift;
            updatedRows.push(newRow);
        }
        savePlanning({ ...planning, rows: updatedRows });
    }
  };

  const handleExportConfirm = async (options: any) => {
      if(!planning) return;
      // Filter rows based on selected roles
      const planningToExport = {
          ...planning,
          rows: planning.rows.filter(r => options.roles.includes(r.employeeRole))
      };
      
      // Pass role map for pretty printing labels
      const roles = await getRoles();
      const roleMap: Record<string, string> = {};
      roles.forEach(r => roleMap[r.id] = r.label);

      generatePDF(planningToExport, templates, { ...options, roleLabels: roleMap });
  };

  const toggleRoleCollapse = (role: string) => {
      const newSet = new Set(collapsedRoles);
      if (newSet.has(role)) newSet.delete(role);
      else newSet.add(role);
      setCollapsedRoles(newSet);
  };

  const getShiftCounts = (shift: Shift | undefined) => {
    if (!shift) return { midi: 0, soir: 0 };
    let m = 0; 
    let s = 0;
    shift.segments.forEach(seg => {
        if(seg.type === 'horaire' && seg.start && seg.end) {
             if(seg.start < "16:00") m = 1;
             if(seg.end >= "16:00") s = 1;
        }
    });
    return { midi: m, soir: s };
  };

  // Calculates Global KPIs (Midi/Soir) for a given date
  // Includes Extras in the calculation
  const getKPIs = (dayDate: string) => {
    if (!planning) return { midi: 0, soir: 0 };
    let midi = 0;
    let soir = 0;
    
    // 1. Count regular employees
    planning.rows.forEach(row => {
      const counts = getShiftCounts(row.shifts[dayDate]);
      midi += counts.midi;
      soir += counts.soir;
    });

    // 2. Count Extras (Multiplying by count)
    const extras = (planning.extraShifts || []).filter(e => e.date === dayDate);
    extras.forEach(e => {
        if (e.start < "16:00") midi += e.count;
        if (e.end >= "16:00") soir += e.count;
    });

    return { midi, soir };
  };

  const groupedRows = useMemo(() => {
    if (!planning) return {};
    const filtered = planning.rows.filter(r => r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || r.employeeRole.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const groups: Record<string, PlanningRow[]> = {};
    filtered.forEach(r => {
      const g = r.employeeRole;
      if (!groups[g]) groups[g] = [];
      groups[g].push(r);
    });
    return groups;
  }, [planning, searchTerm]);

  // Group Totals only count rows (regular employees)
  const getGroupTotals = (rows: PlanningRow[], date: string) => {
      let midi = 0;
      let soir = 0;
      rows.forEach(r => {
          const counts = getShiftCounts(r.shifts[date]);
          midi += counts.midi;
          soir += counts.soir;
      });
      return { midi, soir };
  };

  if (!planning) return <div className="p-10 text-center">Chargement...</div>;

  const weekStartDates = Array.from({length: 7}, (_, i) => format(addDays(parseISO(planning.weekStart), i), 'yyyy-MM-dd'));

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <header className="bg-white border-b border-slate-200 shrink-0 z-50">
        <div className="max-w-[1920px] mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  Planning {planning.service} 
                  <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    Semaine du {format(parseISO(planning.weekStart), 'dd/MM')}
                  </span>
                </h1>
              </div>
           </div>

           <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('SEMAINE')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'SEMAINE' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                Semaine
              </button>
              <button 
                onClick={() => setViewMode('JOUR')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'JOUR' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                Jour
              </button>
           </div>

           <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                 <input 
                   className="pl-8 pr-3 py-1.5 text-sm bg-slate-100 border-transparent focus:bg-white border focus:border-blue-300 rounded-lg outline-none w-48 transition-all"
                   placeholder="Filtrer employé..."
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>
              <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors">
                 <Plus size={16} /> Ajouter
              </button>
              <button onClick={() => setIsExportModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Export PDF">
                 <Download size={20} />
              </button>
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Paramètres">
                 <Settings size={20} />
              </button>
           </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 py-2 overflow-x-auto scrollbar-hide">
           <div className="max-w-[1920px] mx-auto px-4 flex gap-4 min-w-max">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mr-4">
                 <Users size={14} /> Effectifs
              </div>
              {weekStartDates.map((date, idx) => {
                 const kpi = getKPIs(date);
                 const isSelected = viewMode === 'JOUR' && idx === selectedDayIndex;
                 return (
                   <div 
                     key={date} 
                     onClick={() => { if(viewMode === 'JOUR') setSelectedDayIndex(idx); }}
                     className={`flex flex-col px-4 py-1 rounded border cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                   >
                      <span className="text-[10px] font-semibold text-slate-500 mb-0.5">{DAYS[idx].substring(0,3)} {format(parseISO(date), 'dd')}</span>
                      <div className="flex gap-3 text-xs">
                         <span className="text-orange-600 font-bold">M: {kpi.midi}</span>
                         <span className="text-indigo-600 font-bold">S: {kpi.soir}</span>
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-4">
        {viewMode === 'SEMAINE' ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden h-full">
             <div className="flex-1 overflow-auto w-full">
                <table className="w-full text-sm border-collapse relative">
                   <thead>
                      <tr>
                         <th className="sticky left-0 top-0 z-50 bg-slate-50 border-b border-r p-3 text-left w-64 font-semibold text-slate-600 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">Employé</th>
                         {weekStartDates.map((d, i) => (
                           <th key={d} className="sticky top-0 z-40 border-b border-r bg-slate-50 p-2 min-w-[140px] text-center font-medium text-slate-600 shadow-sm">
                             {DAYS[i]} <br/> <span className="text-xs font-normal text-slate-400">{format(parseISO(d), 'dd/MM')}</span>
                           </th>
                         ))}
                      </tr>
                   </thead>
                   <tbody>
                      {Object.entries(groupedRows).map(([role, rows]) => {
                          const isCollapsed = collapsedRoles.has(role);
                          const rowsArray = Array.isArray(rows) ? rows : [];
                          return (
                            <React.Fragment key={role}>
                               <tr 
                                 className="cursor-pointer hover:bg-blue-700 transition-colors"
                                 onClick={() => toggleRoleCollapse(role)}
                               >
                                  <td colSpan={8} className="p-3 bg-blue-600 text-white text-center font-bold text-lg border-b sticky left-0 z-20">
                                    <div className="flex items-center justify-center gap-2">
                                        {isCollapsed ? <ChevronRight size={20}/> : <ChevronDown size={20}/>}
                                        {role}
                                        <span className="text-xs font-normal opacity-80 bg-blue-500 px-2 py-0.5 rounded-full">{rowsArray.length}</span>
                                    </div>
                                  </td>
                               </tr>
                               
                               {!isCollapsed && rowsArray.map(row => (
                                 <tr key={row.employeeId} className="hover:bg-slate-50/50">
                                    <td className="sticky left-0 z-30 bg-white border-b border-r p-3 font-medium text-slate-800 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)] group">
                                       <div className="flex items-center justify-between">
                                         <span>{row.employeeName}</span>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); setEditingEmployee({id: row.employeeId, name: row.employeeName, role: row.employeeRole}); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                                         >
                                            <Edit2 size={14}/>
                                         </button>
                                       </div>
                                    </td>
                                    {weekStartDates.map(date => {
                                       const shift = row.shifts[date];
                                       return (
                                         <td 
                                           key={date} 
                                           className="border-b border-r p-1 h-16 relative group cursor-pointer"
                                           onClick={(e) => {
                                             const rect = e.currentTarget.getBoundingClientRect();
                                             setEditorPos({ x: rect.left, y: rect.bottom + window.scrollY });
                                             // Pass employeeRole to editor
                                             setEditingShift({ 
                                                shift: shift || { date, type: 'repos', serviceType: 'none', segments: [] }, 
                                                employeeId: row.employeeId, 
                                                employeeName: row.employeeName, 
                                                employeeRole: row.employeeRole,
                                                date 
                                             });
                                           }}
                                         >
                                            <ShiftCell shift={shift} templates={templates} />
                                         </td>
                                       );
                                    })}
                                 </tr>
                               ))}
    
                               {!isCollapsed && (
                                   <tr className="bg-slate-100/50">
                                      <td className="sticky left-0 z-30 bg-slate-100/90 border-b border-r p-2 text-right text-xs font-bold text-slate-500 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                                         TOTAL {role}
                                      </td>
                                      {weekStartDates.map(date => {
                                         const totals = getGroupTotals(rowsArray, date);
                                         return (
                                           <td key={date} className="border-b border-r p-2 text-center text-xs font-semibold text-slate-600">
                                              {totals.midi > 0 || totals.soir > 0 ? (
                                                <span>
                                                   <span className={totals.midi > 0 ? "text-orange-600" : "text-slate-300"}>{totals.midi} m</span>
                                                   <span className="mx-1 text-slate-300">/</span>
                                                   <span className={totals.soir > 0 ? "text-indigo-600" : "text-slate-300"}>{totals.soir} s</span>
                                                </span>
                                              ) : <span className="text-slate-300">-</span>}
                                           </td>
                                         );
                                      })}
                                   </tr>
                               )}
                            </React.Fragment>
                          );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto flex-1 overflow-auto w-full">
             <div className="flex justify-center mb-6">
                <div className="flex bg-white rounded-full shadow p-1 sticky top-0 z-10">
                   {DAYS.map((d, i) => (
                     <button
                       key={d}
                       onClick={() => setSelectedDayIndex(i)}
                       className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedDayIndex === i ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                     >
                       {d.substring(0,3)}
                     </button>
                   ))}
                </div>
             </div>
             
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                   <h2 className="font-bold text-slate-700">{DAYS[selectedDayIndex]} {format(parseISO(weekStartDates[selectedDayIndex]), 'dd MMMM', {locale: fr})}</h2>
                   <div className="text-sm text-slate-500">
                      Effectif: <strong className="text-slate-800">{getKPIs(weekStartDates[selectedDayIndex]).midi + getKPIs(weekStartDates[selectedDayIndex]).soir}</strong> shifts
                   </div>
                </div>
                <div className="divide-y">
                   {Object.entries(groupedRows).map(([role, rows]) => {
                     const rowsArray = Array.isArray(rows) ? rows : [];
                     return (
                     <div key={role}>
                        {/* Styled Header for Day View as well */}
                        <div className="bg-blue-600 text-white px-4 py-3 text-lg font-bold text-center uppercase tracking-wide flex justify-between items-center sticky top-14 z-10">
                            <span>{role}</span>
                            <span className="text-xs bg-blue-500 px-2 py-1 rounded text-blue-50 font-mono">
                                {getGroupTotals(rowsArray, weekStartDates[selectedDayIndex]).midi}m / {getGroupTotals(rowsArray, weekStartDates[selectedDayIndex]).soir}s
                            </span>
                        </div>
                        {rowsArray.map(row => {
                           const shift = row.shifts[weekStartDates[selectedDayIndex]];
                           return (
                             <div 
                               key={row.employeeId} 
                               className="px-4 py-4 flex items-center justify-between hover:bg-blue-50/30 cursor-pointer border-b last:border-0"
                               onClick={(e) => {
                                 const rect = e.currentTarget.getBoundingClientRect();
                                 setEditorPos({ x: rect.left + 100, y: rect.bottom + window.scrollY });
                                 setEditingShift({ 
                                    shift, 
                                    employeeId: row.employeeId, 
                                    employeeName: row.employeeName, 
                                    employeeRole: row.employeeRole,
                                    date: weekStartDates[selectedDayIndex] 
                                 });
                               }}
                             >
                                <div className="font-medium text-slate-800 w-1/3 flex flex-col">
                                    <span>{row.employeeName}</span>
                                </div>
                                <div className="flex-1 h-12">
                                   <ShiftCell shift={shift} isDayView templates={templates} />
                                </div>
                             </div>
                           )
                        })}
                     </div>
                     );
                   })}
                </div>
             </div>
          </div>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        onConfirm={handleExportConfirm}
        weekDates={weekStartDates}
      />

      <AddShiftModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        weekStart={planning.weekStart}
        weekDates={weekStartDates}
        onSave={handleAddShiftData}
      />
      
      {editingEmployee && (
        <EditEmployeeModal 
           isOpen={true} 
           employeeId={editingEmployee.id}
           initialName={editingEmployee.name}
           initialRoleId={templates.find(t => t.role === editingEmployee.role)?.role /* Hacky lookup if needed, but really we just use role string */ || editingEmployee.role}
           onClose={() => setEditingEmployee(null)}
        />
      )}

      {editingShift && (
        <ShiftEditor 
          shift={editingShift.shift}
          employeeName={editingShift.employeeName}
          employeeRoleId={editingShift.employeeRole}
          position={editorPos}
          onSave={handleShiftUpdate}
          onClose={() => setEditingShift(null)}
        />
      )}
    </div>
  );
};

// Sub-component for cell rendering with segments and colors
const ShiftCell: React.FC<{ shift: Shift, isDayView?: boolean, templates?: Template[] }> = ({ shift, isDayView, templates }) => {
  if (!shift || !shift.segments || shift.segments.length === 0) return null;

  // Render list of segments joined by /
  return (
    <div className={`w-full h-full flex items-center justify-center gap-1 ${isDayView ? 'flex-row' : 'flex-col justify-center'}`}>
      {shift.segments.map((seg, i) => {
        
        // Style Determination
        let bg = '#ffffff';
        let textStyle: React.CSSProperties = { color: '#1e293b' }; // slate-800
        let borderClass = 'border-slate-200';
        
        if (seg.type === 'code') {
            if (seg.label === 'REPOS') {
                bg = '#000000'; // Black background
                textStyle = { color: '#FFFFFF', fontWeight: 'bold' }; // White text
                borderClass = 'border-black';
            } else if (seg.label && ABSENCE_TYPES.includes(seg.label as any)) {
                // Absences
                bg = '#FFEBEE'; // Red 50-ish
                textStyle = { color: '#D32F2F', fontWeight: 'bold' };
                borderClass = 'border-red-100';
            }
        } else if (seg.type === 'horaire') {
            // Priority: Override > Template > Default
            if (seg.colorOverride) {
                bg = seg.colorOverride;
                borderClass = 'border-transparent';
            } else if (seg.templateId && templates) {
                const tpl = templates.find(t => t.id === seg.templateId);
                if (tpl && tpl.color) {
                    bg = tpl.color;
                    borderClass = 'border-transparent';
                }
            } else {
                bg = '#ffffff'; // Default white
                borderClass = 'border-blue-200';
            }
        }

        const content = seg.type === 'horaire' ? `${seg.start}-${seg.end}` : seg.label;

        return (
            <div 
              key={i} 
              className={`rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap border shadow-sm flex items-center justify-center w-full max-w-[90%]`}
              style={{ backgroundColor: bg }}
            >
                <span className="truncate" style={textStyle}>{content}</span>
            </div>
        );
      })}
    </div>
  );
};

export default PlanningView;
