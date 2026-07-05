import { useEffect, useMemo, useState } from 'react';
import { FileText, Download, CheckCircle, Database } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { toast } from 'sonner';
import { barangaysAPI, reportsAPI } from '../../lib/services/api';

type ReportSummaryItem = {
  label: string;
  value: string | number;
};

type ReportPreview = {
  title: string;
  period: string;
  barangay: string;
  format: string;
  sections: string[];
  summary: ReportSummaryItem[];
  headers: string[];
  rows: Array<Array<string | number>>;
  row_count: number;
  generated_at: string;
};

type GeneratedReport = {
  title: string;
  date: string;
  format: string;
  rowCount: number;
};

const toDateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
};

const startOfCurrentMonth = () => {
  const now = new Date();
  return toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
};

const reportTypes = [
  { value: 'monthly-incident', label: 'Monthly Incident Report' },
  { value: 'annual-vaccination', label: 'Annual Vaccination Summary' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'compliance', label: 'PEP Compliance Report' },
  { value: 'barangay-analysis', label: 'Barangay Analysis Report' },
];

const formatOptions = [
  { value: 'PDF', label: 'PDF Document' },
  { value: 'Excel', label: 'Excel Spreadsheet' },
];

export function Reports() {
  const [reportConfig, setReportConfig] = useState({
    type: 'monthly-incident',
    dateFrom: startOfCurrentMonth(),
    dateTo: toDateKey(new Date()),
    barangay: 'All',
    format: 'PDF',
  });
  const [barangayOptions, setBarangayOptions] = useState([{ value: 'All', label: 'All Barangays' }]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<'PDF' | 'Excel' | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);

  useEffect(() => {
    const loadBarangays = async () => {
      try {
        const response = await barangaysAPI.getAll();
        const options = (response.data || []).map((barangay: any) => ({
          value: barangay.name,
          label: barangay.name,
        }));
        setBarangayOptions([{ value: 'All', label: 'All Barangays' }, ...options]);
      } catch {
        setBarangayOptions([{ value: 'All', label: 'All Barangays' }]);
      }
    };

    loadBarangays();
  }, []);

  const selectedType = useMemo(
    () => reportTypes.find((item) => item.value === reportConfig.type)?.label ?? 'Report',
    [reportConfig.type]
  );

  const updateConfig = (next: Partial<typeof reportConfig>) => {
    setReportConfig((current) => ({ ...current, ...next }));
    setPreview(null);
  };

  const handleGenerate = async () => {
    if (reportConfig.dateFrom > reportConfig.dateTo) {
      toast.error('Date From must be before Date To.');
      return;
    }

    try {
      setGenerating(true);
      const response = await reportsAPI.getSummary(reportConfig);
      setPreview(response.data);
      setGeneratedReports((current) => [
        {
          title: response.data.title,
          date: response.data.generated_at,
          format: reportConfig.format,
          rowCount: response.data.row_count,
        },
        ...current,
      ].slice(0, 5));
      toast.success(response.data.title + ' generated from live database data.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format: 'PDF' | 'Excel') => {
    try {
      setDownloading(format);
      const result = await reportsAPI.download({ ...reportConfig, format });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(format + ' report downloaded: ' + result.filename);
    } catch (error: any) {
      toast.error(error.message || 'Failed to download report.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex-1">
      <Header title="Report Generation" breadcrumbs={['Reports', 'Generate']} />

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-4">Report Configuration</h2>
              <div className="space-y-4">
                <Select
                  label="Report Type"
                  options={reportTypes}
                  value={reportConfig.type}
                  onChange={(event) => updateConfig({ type: event.target.value })}
                />
                <Input
                  label="Date From"
                  type="date"
                  value={reportConfig.dateFrom}
                  onChange={(event) => updateConfig({ dateFrom: event.target.value })}
                />
                <Input
                  label="Date To"
                  type="date"
                  value={reportConfig.dateTo}
                  onChange={(event) => updateConfig({ dateTo: event.target.value })}
                />
                <Select
                  label="Barangay Filter"
                  options={barangayOptions}
                  value={reportConfig.barangay}
                  onChange={(event) => updateConfig({ barangay: event.target.value })}
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : preview ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Re-generate Report
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Generate From Database
                </>
              )}
            </button>

            {preview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleDownload('PDF')}
                  disabled={downloading !== null}
                  className="flex items-center justify-center gap-2 py-2.5 border border-primary text-primary text-sm font-semibold rounded-xl hover:bg-primary-bg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  {downloading === 'PDF' ? 'Downloading...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => handleDownload('Excel')}
                  disabled={downloading !== null}
                  className="flex items-center justify-center gap-2 py-2.5 border border-success text-success text-sm font-semibold rounded-xl hover:bg-success-bg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  {downloading === 'Excel' ? 'Downloading...' : 'Download Excel'}
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Report Preview</h2>
                {preview && (
                  <span className="ml-auto text-xs font-medium text-success bg-success-bg px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>
              <div className="p-8">
                <h1 className="text-xl font-semibold text-foreground mb-1">{preview?.title || selectedType}</h1>
                <p className="text-sm text-muted-foreground mb-0.5">
                  Period: {preview?.period || reportConfig.dateFrom + ' to ' + reportConfig.dateTo}
                </p>
                <p className="text-sm text-muted-foreground mb-0.5">Barangay: {preview?.barangay || reportConfig.barangay}</p>
                <p className="text-sm text-muted-foreground mb-6">Download options: PDF or Excel workbook</p>

                {preview ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                      {preview.summary.map((item) => (
                        <div key={item.label} className="border border-border rounded-lg px-4 py-3 bg-muted/20">
                          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                          <p className="text-lg font-semibold text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <h3 className="text-sm font-semibold text-foreground mb-3">Preview Rows</h3>
                    <div className="overflow-x-auto border border-border rounded-lg mb-4">
                      <table className="w-full min-w-[760px]">
                        <thead>
                          <tr className="bg-muted text-xs font-medium text-muted-foreground">
                            {preview.headers.map((header) => (
                              <th key={header} className="text-left px-4 py-2">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {preview.rows.length === 0 ? (
                            <tr>
                              <td colSpan={preview.headers.length} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                No rows found for this report filter.
                              </td>
                            </tr>
                          ) : preview.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-xs text-muted-foreground text-center border-t border-border pt-4">
                      Showing first {preview.rows.length} of {preview.row_count} row{preview.row_count !== 1 ? 's' : ''}. Download includes the full report.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Report Type</h3>
                    <div className="space-y-2">
                      {reportTypes.map((item, index) => (
                        <div key={item.value} className="flex items-center gap-3 text-sm py-1 border-b border-border/50 last:border-0">
                          <span className="text-muted-foreground font-medium w-5 shrink-0">{index + 1}.</span>
                          <span className={item.value === reportConfig.type ? 'text-primary font-medium' : 'text-foreground'}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-6 text-xs text-muted-foreground text-center border-t border-border pt-4">
                      Click Generate From Database to preview live report totals and rows.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-3">Generated Reports This Session</h3>
              <div className="space-y-2">
                {generatedReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">No reports generated yet.</p>
                ) : generatedReports.map((report, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{report.title}</p>
                      <p className="text-xs text-muted-foreground">{report.date} - {report.format} - {report.rowCount} rows</p>
                    </div>
                    <button
                      onClick={() => handleDownload(report.format === 'Excel' ? 'Excel' : 'PDF')}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold leading-none text-primary hover:bg-primary-bg"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Again
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
