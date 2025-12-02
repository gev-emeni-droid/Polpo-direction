
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Planning, Template, ABSENCE_TYPES, PlanningRow } from '../types';
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
    roleLabels?: Record<string, string>; 
}

export const generatePDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
    if (options.period === 'DAY' && options.selectedDay) {
        generateDayPDF(planning, templates, options);
    } else {
        generatePlanningPDF(planning, templates, options);
    }
};

const getRoleLabel = (roleId: string, map?: Record<string, string>) => map && map[roleId] ? map[roleId] : roleId;

const worksInService = (row: PlanningRow, date: string, service: 'midi' | 'soir'): boolean => {
    const shift = row.shifts[date];
    if (!shift || !shift.segments || shift.segments.length === 0) return false;
    const hasCode = shift.segments.some(s => s.type === 'code');
    if (hasCode) return true;
    return shift.segments.some(s => {
        if (s.type === 'horaire' && s.start) {
            if (service === 'midi') return s.start < "14:00";
            if (service === 'soir') return s.start >= "14:00";
        }
        return false;
    });
};

const generateDayPDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
    const doc = new jsPDF('portrait');
    const dayDate = parseISO(options.selectedDay);
    const dayStr = format(dayDate, 'eeee d MMMM yyyy', { locale: fr }).toUpperCase();
    
    // Maximized Dimensions to fill the page
    const PAGE_HEIGHT = 297;
    const MARGIN_TOP = 15; 
    const MARGIN_BOTTOM = 10;
    const AVAILABLE_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

    const drawServicePage = (serviceName: 'MIDI' | 'SOIR') => {
        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.text(`FEUILLE D'ÉMARGEMENT - SERVICE ${serviceName}`, 10, 10);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`${dayStr} | ${planning.service}`, 10, 15);

        const headRow = ['Employé', 'Horaires'];
        let colIndex = 2;
        const columnStyles: any = {
            0: { cellWidth: 45, fontStyle: 'bold' }, // Nom
            1: { cellWidth: 30, halign: 'center' },  // Horaires
        };

        if (options.columns.arrival) {
            headRow.push('Arrivée');
            columnStyles[colIndex] = { cellWidth: 20 };
            colIndex++;
        }
        if (options.columns.departure) {
            headRow.push('Départ');
            columnStyles[colIndex] = { cellWidth: 20 };
            colIndex++;
        }
        // Signature takes remaining space implicitly by not defining width
        if (options.columns.signature) {
            headRow.push('Signature');
        }

        const serviceRows = planning.rows.filter(row => 
            options.roles.includes(row.employeeRole) && 
            worksInService(row, options.selectedDay, serviceName.toLowerCase() as 'midi'|'soir')
        );

        serviceRows.sort((a, b) => {
            if (a.employeeRole !== b.employeeRole) return a.employeeRole.localeCompare(b.employeeRole);
            return a.employeeName.localeCompare(b.employeeName);
        });
        
        const bodyData: any[] = [];
        let currentRole = '';
        let rowCount = 0;

        serviceRows.forEach(row => {
            if (row.employeeRole !== currentRole) {
                currentRole = row.employeeRole;
                rowCount++;
                bodyData.push([{ 
                    content: getRoleLabel(currentRole, options.roleLabels).toUpperCase(), 
                    colSpan: headRow.length, 
                    styles: { 
                        fillColor: [37, 99, 235], 
                        textColor: [255, 255, 255], 
                        fontStyle: 'bold', 
                        halign: 'center',
                        cellPadding: 1,
                        fontSize: 8
                    } 
                }]);
            }
            rowCount++;
            const shift = row.shifts[options.selectedDay];
            let cellContent: any = '';
            
            if (shift && shift.segments && shift.segments.length > 0) {
                const segsToDisplay = shift.segments.filter(s => {
                    if (s.type === 'code') return true; 
                    if (s.type === 'horaire' && s.start) {
                        if (serviceName === 'MIDI') return s.start < "14:00";
                        if (serviceName === 'SOIR') return s.start >= "14:00";
                    }
                    return false;
                });

                if (segsToDisplay.length > 0) {
                    const text = segsToDisplay.map(s => {
                        if (s.type === 'code') return s.label;
                        return `${s.start}-${s.end}`;
                    }).join(' / ');

                    let styles: any = {};
                    const first = segsToDisplay[0];
                    if (first.type === 'code') {
                        if (first.label === 'REPOS') { styles = { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }; }
                        else if (first.label === 'Ecole') { styles = { fillColor: [239, 235, 233], textColor: [93, 64, 55], fontStyle: 'bold', halign: 'center' }; }
                        else if (ABSENCE_TYPES.includes(first.label as any)) { styles = { fillColor: [255, 235, 238], textColor: [211, 47, 47], fontStyle: 'bold', halign: 'center' }; }
                    }
                    if (Object.keys(styles).length > 0) { cellContent = { content: text, styles }; } 
                    else { cellContent = text; }
                }
            }
            
            const rowData = [row.employeeName, cellContent];
            if (options.columns.arrival) rowData.push('');
            if (options.columns.departure) rowData.push('');
            if (options.columns.signature) rowData.push('');
            bodyData.push(rowData);
        });

        const extras = (planning.extraShifts || []).filter(e => {
            if (e.date !== options.selectedDay) return false;
            if (serviceName === 'MIDI') return e.start < "14:00";
            if (serviceName === 'SOIR') return e.start >= "14:00";
            return false;
        });

        if (extras.length > 0) {
             rowCount++; 
             bodyData.push([{ content: "RENFORTS / EXTRAS", colSpan: headRow.length, styles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', cellPadding: 1, fontSize: 8 } }]);
            extras.forEach(extra => {
                rowCount++;
                const countLabel = extra.count > 1 ? `(x${extra.count})` : '';
                const rowData = [`${extra.label} ${countLabel}`, `${extra.start}-${extra.end}`];
                if (options.columns.arrival) rowData.push('');
                if (options.columns.departure) rowData.push('');
                if (options.columns.signature) rowData.push('');
                bodyData.push(rowData);
            });
        }

        if (rowCount === 0) {
             bodyData.push([{ content: "Aucun personnel pour ce service.", colSpan: headRow.length, styles: { halign: 'center', fontStyle: 'italic', textColor: 150 } }]);
        }

        // CALCULATE DYNAMIC HEIGHT TO FILL PAGE
        // We removed the Math.min(25) constraint so it stretches fully
        const availableForRows = AVAILABLE_HEIGHT - 10; // minus header estimate
        let dynamicRowHeight = rowCount > 0 ? Math.floor(availableForRows / rowCount) : 10;
        
        // Minimum viable height for signature
        dynamicRowHeight = Math.max(8, dynamicRowHeight);

        autoTable(doc, {
            startY: 20,
            head: [headRow],
            body: bodyData,
            theme: 'grid',
            margin: { top: 10, right: 5, bottom: 5, left: 5 },
            styles: { 
                fontSize: 7, 
                cellPadding: 1,
                minCellHeight: dynamicRowHeight, // Forces expansion
                valign: 'middle', 
                lineColor: [200, 200, 200] 
            },
            headStyles: { 
                fillColor: [241, 245, 249], 
                textColor: [71, 85, 105], 
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center',
                minCellHeight: 8
            },
            columnStyles: columnStyles,
            rowPageBreak: 'avoid'
        });
    };

    drawServicePage('MIDI');
    doc.addPage();
    drawServicePage('SOIR');
    doc.save(`Emargement_${options.selectedDay}_Midi_Soir.pdf`);
};

export const generatePlanningPDF = (planning: Planning, templates: Template[], options: ExportOptions) => {
  const doc = new jsPDF('landscape');
  doc.setFontSize(18);
  doc.text(`Planning Polpo - ${planning.service}`, 14, 15);
  doc.setFontSize(11);
  doc.setTextColor(100);
  const start = format(parseISO(planning.weekStart), 'dd MMMM yyyy', { locale: fr });
  const end = format(parseISO(planning.weekEnd), 'dd MMMM yyyy', { locale: fr });
  doc.text(`Semaine du ${start} au ${end}`, 14, 22);

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const weekDates = Array.from({length: 7}, (_, i) => format(addDays(parseISO(planning.weekStart), i), 'yyyy-MM-dd'));

  const bodyData: any[] = [];
  const sortedRows = [...planning.rows].sort((a, b) => a.employeeRole.localeCompare(b.employeeRole));
  let currentRole = '';

  sortedRows.forEach(row => {
    if (row.employeeRole !== currentRole) {
        currentRole = row.employeeRole;
        bodyData.push([{ content: getRoleLabel(currentRole, options.roleLabels).toUpperCase(), colSpan: 8, styles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 10 } }]);
    }

    const rowData: any[] = [row.employeeName];

    weekDates.forEach(date => {
      const s = row.shifts[date];
      if (!s || !s.segments || s.segments.length === 0) { rowData.push(''); return; }
      const parts = s.segments.map(seg => {
          if (seg.type === 'horaire') return `${seg.start}-${seg.end}`;
          return seg.label || '';
      }).filter(Boolean).join('\n');
      
      let cellColor: string | null = null;
      let textColor = null;
      const seg = s.segments[0];
      
      if (seg.type === 'code') {
          if (seg.label === 'REPOS') { cellColor = '#000000'; textColor = '#FFFFFF'; }
          else if (seg.label === 'Ecole') { cellColor = '#EFEBE9'; textColor = '#5D4037'; }
          else if (seg.label && ABSENCE_TYPES.includes(seg.label as any)) { cellColor = '#FFEBEE'; textColor = '#D32F2F'; }
      } else if (seg.type === 'horaire') {
          const coloredSegment = s.segments.find(seg => seg.type === 'horaire' && (seg.colorOverride || seg.templateId));
          if (coloredSegment) {
             if (coloredSegment.colorOverride) { cellColor = coloredSegment.colorOverride; } 
             else if (coloredSegment.templateId) {
                 const tpl = templates.find(t => t.id === coloredSegment.templateId);
                 if (tpl && tpl.color) { cellColor = tpl.color; }
             }
          }
      }

      const styles: any = {};
      if (cellColor) {
           const hexToRgb = (hex: string) => { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null; }
           const rgb = hexToRgb(cellColor);
           if (rgb) styles.fillColor = rgb;
      }
      if (textColor) {
          const hexToRgb = (hex: string) => { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null; }
           const rgb = hexToRgb(textColor);
           if (rgb) styles.textColor = rgb;
      }
      if (Object.keys(styles).length > 0) { rowData.push({ content: parts, styles }); } else { rowData.push(parts); }
    });

    bodyData.push(rowData);
  });

  const kpiRow = ['TOTAL STAFF'];
  weekDates.forEach(date => {
     let midi = 0; let soir = 0;
     planning.rows.forEach(r => {
        const s = r.shifts[date];
        if(s?.segments) {
            s.segments.forEach(seg => {
                if(seg.type === 'horaire' && seg.start && seg.end) {
                    if(seg.start < "16:00") midi++;
                    if(seg.end >= "16:00" || seg.end < seg.start) soir++;
                }
            });
        }
     });
     const extras = (planning.extraShifts || []).filter(e => e.date === date);
     extras.forEach(e => {
        if (e.start < "16:00") midi += e.count;
        if (e.end >= "16:00" || e.end < e.start) soir += e.count;
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
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 } }
  });

  doc.save(`Planning_${planning.service}_${planning.weekStart}.pdf`);
};
