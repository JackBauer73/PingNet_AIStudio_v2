import React, { useEffect, useRef, useState } from 'react';
import { useTournament } from '../../hooks/useTournament';
import { supabase } from '../../supabase';
import { QRCodeSVG } from 'qrcode.react';
import { FileDown, Printer, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function PrintQR() {
  const { tournament, loading } = useTournament();
  const baseUrl = window.location.origin;
  const [generating, setGenerating] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [customDaysCount, setCustomDaysCount] = useState<number | null>(null);
  const [customTablesCount, setCustomTablesCount] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tournament?.id) return;

    const fetchCategories = async () => {
      try {
        const { data } = await supabase
          .from('table_categories')
          .select('day_number, name, start_time, color_code')
          .eq('tournament_id', tournament.id);
        
        if (data) setCategories(data);
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setLoadingDays(false);
      }
    };

    fetchCategories();
  }, [tournament?.id]);

  const downloadPDF = async () => {
    if (!containerRef.current) return;
    setGenerating(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const elements = containerRef.current.querySelectorAll('.qr-page');
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        if (i > 0) pdf.addPage();
        
        // Center the content vertically if it's shorter than the page
        const yPos = Math.max(0, (pdf.internal.pageSize.getHeight() - pdfHeight) / 2);
        pdf.addImage(imgData, 'PNG', 0, yPos, pdfWidth, pdfHeight);
      }
      
      pdf.save(`QR_Codes_${tournament?.name || 'Tournois'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading || loadingDays) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
      <p className="text-slate-500 font-medium">Chargement des QR Codes...</p>
    </div>
  );
  
  if (!tournament) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Tournoi non trouvé</h2>
        <p className="text-slate-500 mb-6">Veuillez vérifier que vous avez bien créé un tournoi.</p>
        <button 
          onClick={() => window.close()}
          className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold"
        >
          Fermer l'onglet
        </button>
      </div>
    </div>
  );

  // Calcul de la durée du tournoi basée sur ses dates de début et de fin, complétée par les catégories
  const getDaysCount = () => {
    if (!tournament.date) return 1;
    if (!tournament.end_date) return 1;
    const start = new Date(tournament.date);
    const end = new Date(tournament.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const dbDays = categories.map((c: any) => c.day_number || 1);
  const calculatedDaysCount = Math.max(getDaysCount(), ...dbDays, 1);
  const totalDaysCount = customDaysCount !== null ? customDaysCount : calculatedDaysCount;

  const dbTablesCount = tournament.nb_tables || 0;
  const totalTablesCount = customTablesCount !== null ? customTablesCount : dbTablesCount;

  // Liste de toutes les journées (ex: [1, 2])
  const days = Array.from({ length: totalDaysCount }, (_, i) => i + 1);
  
  // Pour chaque journée, lister les tableaux du jour
  const categoriesByDay = days.map((d: any) => ({
    day: d,
    categories: categories.filter((c: any) => (c.day_number || 1) === d)
  }));

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      {/* Header controls */}
      <div className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200 p-4 print:hidden">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-between items-center gap-6">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-bold text-slate-900">QR Codes d'Accueil & Tables</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              {days.length} journée(s) + {totalTablesCount} tables à imprimer
            </p>
          </div>

          {/* Dynamic selectors for manually forcing days/tables count */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Days Selector */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <span>Journées d'accueil :</span>
              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-300 p-0.5">
                <button
                  type="button"
                  onClick={() => setCustomDaysCount(Math.max(1, totalDaysCount - 1))}
                  className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 text-slate-800 rounded font-black text-xs active:scale-90"
                >
                  -
                </button>
                <span className="w-8 text-center font-bold text-slate-900 text-xs">
                  {totalDaysCount}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomDaysCount(Math.min(10, totalDaysCount + 1))}
                  className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 text-slate-800 rounded font-black text-xs active:scale-90"
                >
                  +
                </button>
              </div>
            </div>

            {/* Tables Selector */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <span>Tables physiques :</span>
              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-300 p-0.5">
                <button
                  type="button"
                  onClick={() => setCustomTablesCount(Math.max(0, totalTablesCount - 1))}
                  className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 text-slate-800 rounded font-black text-xs active:scale-90"
                >
                  -
                </button>
                <span className="w-8 text-center font-bold text-slate-900 text-xs">
                  {totalTablesCount}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomTablesCount(Math.min(60, totalTablesCount + 1))}
                  className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 text-slate-800 rounded font-black text-xs active:scale-90"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button
              onClick={downloadPDF}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Exporter en PDF
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 pb-20 print:p-0" ref={containerRef}>
        <div className="max-w-4xl mx-auto space-y-12 print:space-y-0">
          
          {/* Section QR Journées */}
          {categoriesByDay.map(({ day, categories }) => (
            <div key={`day-${day}`} className="qr-page bg-white p-12 text-center min-h-[290mm] flex flex-col items-center justify-center print:min-h-0 print:h-[297mm] print:page-break-after-always">
              <div className="w-full max-w-lg border-[12px] border-[#0f1f3d] rounded-[4rem] p-16 flex flex-col items-center shadow-sm">
                <div className="mb-6 text-[#0f1f3d] font-mono text-3xl font-black tracking-widest">
                  TOURNOIS TT
                </div>
                
                <h2 className="text-8xl font-black mb-12 text-[#0f1f3d] tracking-tighter italic">
                  JOURNÉE <span className="text-[#f97316]">{day}</span>
                </h2>
                
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 mb-12">
                  <QRCodeSVG
                    value={`${baseUrl}/organizer/checkin-scan/${day}`}
                    size={300}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                <div className="space-y-4 w-full">
                  <p className="text-2xl text-[#0f1f3d] font-bold uppercase tracking-wider">
                    Scanner pour pointer
                  </p>
                  
                  {/* Liste des tableaux du jour */}
                  <div className="text-slate-500 text-sm font-semibold max-w-xs mx-auto divide-y divide-slate-100 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1.5 text-center">Tableaux du jour</p>
                    {categories.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1 text-center">Aucun tableau</p>
                    ) : (
                      categories.map((cat: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-1.5 text-left text-xs text-slate-600 font-bold">
                          <span className="truncate max-w-[150px]">{cat.name}</span>
                          {cat.start_time && (
                            <span className="text-slate-400 shrink-0 font-bold">({cat.start_time})</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-300 font-mono tabular-nums opacity-60">
                    {baseUrl}/organizer/checkin-scan/{day}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Section QR Tables physiques */}
          {Array.from({ length: totalTablesCount }, (_, i) => i + 1).map(n => (
            <div key={n} className="qr-page bg-white p-12 text-center min-h-[290mm] flex flex-col items-center justify-center print:min-h-0 print:h-[297mm] print:page-break-after-always">
              <div className="w-full max-w-lg border-[12px] border-slate-900 rounded-[4rem] p-16 flex flex-col items-center shadow-sm">
                <div className="mb-6 text-slate-900 font-mono text-3xl font-black tracking-widest">
                  TOURNOIS TT
                </div>
                
                <h2 className="text-8xl font-black mb-12 text-slate-900 tracking-tighter italic">
                  TABLE <span className="text-indigo-600">{n}</span>
                </h2>
                
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 mb-12">
                  <QRCodeSVG
                    value={`${baseUrl}/table/${n}`}
                    size={350}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-2xl text-slate-500 font-bold uppercase tracking-wider">
                    Scannez pour le score
                  </p>
                  <p className="text-sm text-slate-300 font-mono tabular-nums opacity-50">
                    {baseUrl}/table/{n}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          @page { 
            size: A4;
            margin: 0; 
          }
          body { 
            background: white; 
            margin: 0;
          }
          .qr-page {
            page-break-after: always;
            break-after: page;
            height: 100vh;
            display: flex !important;
            align-items: center;
            justify-content: center;
          }
          .sticky { display: none !important; }
        }
        .qr-page {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      `}</style>
    </div>
  );
}
