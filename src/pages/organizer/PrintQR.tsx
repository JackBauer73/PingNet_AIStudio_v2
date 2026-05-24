import React, { useEffect, useRef, useState } from 'react';
import { useTournament } from '../../hooks/useTournament';
import { QRCodeSVG } from 'qrcode.react';
import { FileDown, Printer, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function PrintQR() {
  const { tournament, loading } = useTournament();
  const baseUrl = window.location.origin;
  const [generating, setGenerating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (loading) return (
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

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header controls */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 print:hidden">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">QR Codes des Tables</h1>
            <p className="text-xs text-slate-500">{tournament.nb_tables} tables à imprimer</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button
              onClick={downloadPDF}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
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
          {Array.from({ length: tournament.nb_tables || 0 }, (_, i) => i + 1).map(n => (
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
