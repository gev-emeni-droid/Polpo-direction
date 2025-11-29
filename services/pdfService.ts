
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Planning, Template, ABSENCE_TYPES } from '../types';
import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExportOptions {
    roles: string[];
    period: 'WEEK' | 'DAY';
    selectedDay: string;
    columns: {
      arrival: boolean;
      departure: boolean;
      signature: boolean;
    };
    roleLabels?: Record<string, string>; // Map id -> label
}

export const generatePDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
    if (options.period === 'DAY' && options.selectedDay) {
        generateDayPDF(planning, templates, options);
    } else {
        generatePlanningPDF(planning, templates, options);
    }
};

const getRoleLabel = (roleId: string, map?: Record<string, string>) => {
    return map && map[roleId] ? map[roleId] : roleId;
};

const generateDayPDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
    const doc = new jsPDF('portrait'); // Portrait for list view usually better, or landscape if many columns

    const dayDate = parseISO(options.selectedDay);
    const dayStr = format(dayDate, 'eeee d MMMM yyyy', { locale: fr }).toUpperCase();
    
    // Header
    doc.setFontSize(16);
    doc.text(`Planning Polpo - ${planning.service}`, 14, 15);
    doc.setFontSize(12);
    doc.setTextColor(80);
    doc.text(`${dayStr}`, 14, 22);

    // Prepare Columns
    const headRow = ['Employé', 'Poste', 'Horaires Prévus'];
    if (options.columns.arrival) headRow.push('Arrivée');
    if (options.columns.departure) headRow.push('Départ');
    if (options.columns.signature) headRow.push('Signature');

    // Prepare Body
    const bodyData: any[] = [];
    
    // Sort by role then name
    const sortedRows = [...planning.rows].sort((a, b) => {
        if (a.employeeRole !== b.employeeRole) return a.employeeRole.localeCompare(b.employeeRole);
        return a.employeeName.localeCompare(b.employeeName);
    });

    let currentRole = '';

    sortedRows.forEach(row => {
        if (row.employeeRole !== currentRole) {
            currentRole = row.employeeRole;
             bodyData.push([{ 
                content: getRoleLabel(currentRole, options.roleLabels).toUpperCase(), 
                colSpan: headRow.length, 
                styles: { 
                    fillColor: [37, 99, 235],
                    textColor: [255, 255, 255], 
                    fontStyle: 'bold', 
                    halign: 'center'
                } 
            }]);
        }

        const shift = row.shifts[options.selectedDay];
        let shiftText = '';
        if (shift && shift.segments) {
            shiftText = shift.segments.map(s => {
                if (s.type === 'horaire') return `${s.start}-${s.end}`;
                return s.label;
            }).join(' / ');
        }

        const roleLabel = getRoleLabel(row.employeeRole, options.roleLabels);
        const rowData = [row.employeeName, roleLabel, shiftText];
        
        // Add empty cells for manual entry
        if (options.columns.arrival) rowData.push('');
        if (options.columns.departure) rowData.push('');
        if (options.columns.signature) rowData.push('');

        bodyData.push(rowData);
    });

    autoTable(doc, {
        startY: 30,
        head: [headRow],
        body: bodyData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold' } // Name
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
                 const text = data.cell.text[0] || "";
                 // Use exact match or contains check for REPOS/Absence
                 if (text === 'REPOS' || text.includes('REPOS')) {
                     // REPOS: White Text, Black Background
                     data.cell.styles.fillColor = [0, 0, 0];
                     data.cell.styles.textColor = [255, 255, 255];
                 } else if (ABSENCE_TYPES.some(a => text.includes(a))) {
                     // Absence: Red text, Light Red background
                     data.cell.styles.fillColor = [255, 235, 238]; // #FFEBEE
                     data.cell.styles.textColor = [211, 47, 47];   // #D32F2F
                 }
            }
        }
    });

    doc.save(`Planning_Jour_${options.selectedDay}.pdf`);
};

export const generatePlanningPDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
  const doc = new jsPDF('landscape');

  // Header
  doc.setFontSize(18);
  doc.text(`Planning Polpo - ${planning.service}`, 14, 15);
  doc.setFontSize(11);
  doc.setTextColor(100);
  const start = format(parseISO(planning.weekStart), 'dd MMMM yyyy', { locale: fr });
  const end = format(parseISO(planning.weekEnd), 'dd MMMM yyyy', { locale: fr });
  doc.text(`Semaine du ${start} au ${end}`, 14, 22);

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const weekDates = Array.from({length: 7}, (_, i) => format(addDays(parseISO(planning.weekStart), i), 'yyyy-MM-dd'));

  // Prepare table body
  const bodyData: any[] = [];
  
  const sortedRows = [...planning.rows].sort((a, b) => a.employeeRole.localeCompare(b.employeeRole));
  
  let currentRole = '';

  sortedRows.forEach(row => {
    // Add group header row if role changes
    if (row.employeeRole !== currentRole) {
        currentRole = row.employeeRole;
        // Role Header Style: Blue background, White text, Bold, Centered
        bodyData.push([{ 
            content: getRoleLabel(currentRole, options.roleLabels).toUpperCase(), 
            colSpan: 8, 
            styles: { 
                fillColor: [37, 99, 235], // Blue 600
                textColor: [255, 255, 255], 
                fontStyle: 'bold', 
                halign: 'center',
                fontSize: 10
            } 
        }]);
    }

    const rowData: any[] = [
      row.employeeName
    ];

    weekDates.forEach(date => {
      const s = row.shifts[date];
      if (!s || !s.segments || s.segments.length === 0) {
        rowData.push('');
        return;
      }
      
      const parts = s.segments.map(seg => {
          if (seg.type === 'horaire') return `${seg.start}-${seg.end}`;
          return seg.label || '';
      }).filter(Boolean).join('\n');
      
      // Determine dominant color for cell background
      let cellColor: string | null = null;
      let textColor = null; // for REPOS/Absence override

      const seg = s.segments[0]; // Check first segment for main color type
      
      if (seg.type === 'code') {
          if (seg.label === 'REPOS') {
              // Black Bg, White text
              cellColor = '#000000';
              textColor = '#FFFFFF';
          } else if (seg.label && ABSENCE_TYPES.includes(seg.label as any)) {
              // Absences
              cellColor = '#FFEBEE'; // Light Red
              textColor = '#D32F2F'; // Red Text
          }
      } else if (seg.type === 'horaire') {
          // Use template/override colors
          const coloredSegment = s.segments.find(seg => seg.type === 'horaire' && (seg.colorOverride || seg.templateId));
          if (coloredSegment) {
             if (coloredSegment.colorOverride) {
                 cellColor = coloredSegment.colorOverride;
             } else if (coloredSegment.templateId) {
                 const tpl = templates.find(t => t.id === coloredSegment.templateId);
                 if (tpl && tpl.color) {
                     cellColor = tpl.color;
                 }
             }
          }
      }

      const styles: any = {};
      if (cellColor) {
           const hexToRgb = (hex: string) => {
              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return result ? [
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16)
              ] : null;
           }
           const rgb = hexToRgb(cellColor);
           if (rgb) styles.fillColor = rgb;
      }
      if (textColor) {
          const hexToRgb = (hex: string) => {
              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return result ? [
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16)
              ] : null;
           }
           const rgb = hexToRgb(textColor);
           if (rgb) styles.textColor = rgb;
      }

      if (Object.keys(styles).length > 0) {
           rowData.push({ content: parts, styles });
      } else {
           rowData.push(parts);
      }
    });

    bodyData.push(rowData);
  });

  // KPI Row
  const kpiRow = ['TOTAL STAFF'];
  weekDates.forEach(date => {
     let midi = 0;
     let soir = 0;
     planning.rows.forEach(r => {
        const s = r.shifts[date];
        if(s?.segments) {
            s.segments.forEach(seg => {
                if(seg.type === 'horaire' && seg.start && seg.end) {
                    if(seg.start < "16:00") midi++;
                    if(seg.end >= "16:00") soir++;
                }
            });
        }
     });
     // Extras - Multiply by count
     const extras = (planning.extraShifts || []).filter(e => e.date === date);
     extras.forEach(e => {
        if (e.start < "16:00") midi += e.count;
        if (e.end >= "16:00") soir += e.count;
     });

     kpiRow.push(`M: ${midi} / S: ${soir}`);
  });
  
  bodyData.push([{ content: '', colSpan: 8, styles: { fillColor: [255, 255, 255], lineColor: [255,255,255] } }]);
  bodyData.push(kpiRow);

  autoTable(doc, {
    startY: 30,
    head: [['Employé', ...days]],
    body: bodyData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', halign: 'center', valign: 'middle' },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 },
    }
    // Note: didParseCell logic removed here as we apply styles during row construction for better control over mixed segments
  });

  doc.save(`Planning_${planning.service}_${planning.weekStart}.pdf`);
};
