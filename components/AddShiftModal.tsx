
import React, { useState, useEffect } from 'react';
import { X, UserPlus, Users, Calendar, Clock } from 'lucide-react';
import { Employee, Shift, ShiftServiceType } from '../types';
import { getEmployees, saveEmployees, getRoles } from '../services/storage';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AddShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { 
    employeeId: string; 
    employeeName: string; 
    employeeRole: string; 
    isExtra: boolean;
    date: string;
    shift: Shift;
    extraCount?: number;
    extraType?: "Hôtesse LBE" | "Brigad Plage" | "Agent de sécurité";
  }) => void;
  weekStart: string; // YYYY-MM-DD
  weekDates: string[];
}

const AddShiftModal: React.FC<AddShiftModalProps> = ({ isOpen, onClose, onSave, weekDates }) => {
  const [mode, setMode] = useState<'new_employee' | 'extra'>('new_employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // -- Common --
  const [selectedDate, setSelectedDate] = useState(weekDates[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('15:00');
  
  // -- New Employee Mode --
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<string>(''); // Will initialize from roles
  const [shiftLabel, setShiftLabel] = useState(''); // Text libre for new employee shift

  // -- Extra Mode --
  const [extraCount, setExtraCount] = useState<number>(1);
  const [extraType, setExtraType] = useState<"Hôtesse LBE" | "Brigad Plage" | "Agent de sécurité">("Hôtesse LBE");

  const roles = getRoles();

  useEffect(() => {
    if (isOpen) {
      const allEmps = getEmployees();
      setEmployees(allEmps);
      
      // Reset form
      setMode('new_employee');
      
      setNewEmpName('');
      if (roles.length > 0) setNewEmpRole(roles[0].id);
      else setNewEmpRole('');

      setShiftLabel('');

      // Init Extra
      setExtraCount(1);
      setExtraType("Hôtesse LBE");
      
      setStartTime('10:00');
      setEndTime('15:00');
      // Default date is first day
      if (weekDates.length > 0) setSelectedDate(weekDates[0]);
    }
  }, [isOpen, weekDates]);

  const calculateServiceType = (start: string, end: string): ShiftServiceType => {
    const hasMidi = start < "16:00";
    const hasSoir = end >= "16:00"; 
    if (hasMidi && hasSoir) return 'midi+soir';
    if (hasMidi) return 'midi';
    if (hasSoir) return 'soir';
    return 'none';
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const formatFrenchDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    return capitalize(format(d, 'eeee d MMMM', { locale: fr }));
  };

  const handleSubmit = () => {
    if (!startTime || !endTime) return alert("Heures requises.");

    let empId = '';
    let empName = '';
    let empRole = '';
    let isExtra = false;

    if (mode === 'new_employee') {
       if (!newEmpName.trim()) return alert("Nom de l'employé requis.");
       
       // Create new employee globally
       const newEmp: Employee = {
           id: crypto.randomUUID(),
           name: newEmpName.trim(),
           role: newEmpRole,
           isActive: true,
           weeklyDefault: {}
       };
       
       // Save to storage
       const updatedEmployees = [...employees, newEmp];
       saveEmployees(updatedEmployees);
       setEmployees(updatedEmployees); // Update local state if needed
       
       empId = newEmp.id;
       empName = newEmp.name;
       empRole = newEmp.role;
       isExtra = false;

    } else {
       // Extra Mode: Anonymous, just passing counts and type
       empId = 'extra-placeholder';
       empName = 'Extra';
       empRole = 'EXTRA'; 
       isExtra = true;
    }

    const sType = calculateServiceType(startTime, endTime);
    
    // Create segment (used for Employee row, ignored for Extra logic in parent but structure needed)
    const newShift: Shift = {
      date: selectedDate,
      type: 'travail',
      serviceType: sType,
      segments: [{
          type: 'horaire',
          start: startTime,
          end: endTime,
      }]
    };

    onSave({
      employeeId: empId,
      employeeName: empName,
      employeeRole: empRole,
      isExtra,
      date: selectedDate,
      shift: newShift,
      extraCount: isExtra ? extraCount : undefined,
      extraType: isExtra ? extraType : undefined
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="text-blue-600" /> Ajouter au planning
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setMode('new_employee')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'new_employee' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <UserPlus size={16} /> Nouvel Employé
          </button>
          <button
            onClick={() => setMode('extra')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'extra' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users size={16} /> Extra / Renfort
          </button>
        </div>

        <div className="space-y-5">
          
          {/* --- TAB 1: NEW EMPLOYEE --- */}
          {mode === 'new_employee' && (
             <>
                <div className="bg-blue-50 border border-blue-100 text-blue-800 px-3 py-2 rounded text-xs">
                   Crée une fiche employé et l'ajoute au planning.
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nom de l'employé <span className="text-red-500">*</span></label>
                    <input 
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: Thomas Durand"
                      value={newEmpName}
                      onChange={e => setNewEmpName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Poste <span className="text-red-500">*</span></label>
                    <select 
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newEmpRole}
                      onChange={e => setNewEmpRole(e.target.value)}
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                </div>
             </>
          )}

          {/* --- TAB 2: EXTRA --- */}
          {mode === 'extra' && (
             <>
               <div className="bg-purple-50 border border-purple-100 text-purple-800 px-3 py-2 rounded text-xs">
                   Ajoute un nombre défini de renforts pour impacter les effectifs (KPI) sans créer de ligne dans le tableau.
               </div>
               
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Type de renfort <span className="text-red-500">*</span></label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    value={extraType}
                    onChange={e => setExtraType(e.target.value as any)}
                  >
                     <option value="Hôtesse LBE">Hôtesse LBE</option>
                     <option value="Brigad Plage">Brigad Plage</option>
                     <option value="Agent de sécurité">Agent de sécurité</option>
                  </select>
               </div>

               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre de renforts <span className="text-red-500">*</span></label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    value={extraCount}
                    onChange={e => setExtraCount(parseInt(e.target.value) || 1)}
                  />
               </div>
             </>
          )}

          <hr className="border-slate-100" />

          {/* --- COMMON FIELDS --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm capitalize"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                >
                   {weekDates.map(d => (
                     <option key={d} value={d}>
                       {formatFrenchDate(d)}
                     </option>
                   ))}
                </select>
             </div>
             
             {mode === 'new_employee' && (
               <div className="col-span-1 md:col-span-2">
                 <label className="block text-sm font-semibold text-slate-700 mb-1">Libellé (optionnel)</label>
                 <input 
                   className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                   placeholder="Ex: Formation, Essai..."
                   value={shiftLabel}
                   onChange={e => setShiftLabel(e.target.value)}
                 />
               </div>
             )}
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
             <div>
                <label className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase mb-1"><Clock size={12}/> Début</label>
                <input 
                  type="time" 
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
             </div>
             <div>
                <label className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase mb-1"><Clock size={12}/> Fin</label>
                <input 
                  type="time" 
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
             </div>
             <div className="col-span-2 text-xs text-center text-slate-400 italic mt-1">
                {startTime < "16:00" ? (endTime >= "16:00" ? "Compté en Midi & Soir" : "Compté en Midi") : "Compté en Soir"}
             </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={handleSubmit} className={`flex-1 py-2.5 rounded-lg text-white font-medium shadow-sm transition-colors ${mode === 'extra' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {mode === 'extra' ? 'Ajouter Renfort' : 'Créer Employé'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddShiftModal;
