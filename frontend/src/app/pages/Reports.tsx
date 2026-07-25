import { useEffect, useMemo, useState } from 'react';
import { FileText, Download, CheckCircle, ClipboardList } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { toast } from 'sonner';
import { barangaysAPI, getErrorMessage, reportsAPI, type BarangayListItem } from '../../lib/services/api';

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

type ReportConfig = {
  type: string;
  dateFrom: string;
  dateTo: string;
  barangay: string;
  format: string;
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

const getSummaryValue = (preview: ReportPreview, labels: string[], fallback: string | number = 0) => {
  const item = preview.summary.find((summaryItem) => labels.includes(summaryItem.label));
  return item?.value ?? fallback;
};

const countRowsByCell = (preview: ReportPreview, header: string, matcher: (value: string) => boolean) => {
  const index = preview.headers.indexOf(header);
  if (index < 0) return 0;

  return preview.rows.filter((row) => matcher(String(row[index] ?? ''))).length;
};

const parsePercent = (value: string | number) => {
  const parsed = Number(String(value).replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getPreviewSummary = (preview: ReportPreview, reportType: string): ReportSummaryItem[] => {
  if (reportType === 'monthly-incident') {
    return [
      { label: 'Total Incidents', value: getSummaryValue(preview, ['Total Bite Cases']) },
      { label: 'Category I', value: countRowsByCell(preview, 'WHO', (value) => value.includes('I') && !value.includes('II')) },
      { label: 'Category II', value: countRowsByCell(preview, 'WHO', (value) => value.includes('II') && !value.includes('III')) },
      { label: 'Category III', value: countRowsByCell(preview, 'WHO', (value) => value.includes('III')) },
      { label: 'Top Barangay', value: getSummaryValue(preview, ['Top Barangay'], 'None') },
      { label: 'Top Animal Type', value: getSummaryValue(preview, ['Top Animal Type'], 'None') },
    ];
  }

  if (reportType === 'annual-vaccination') {
    const total = Number(getSummaryValue(preview, ['Scheduled Doses'], 0));
    const completed = Number(getSummaryValue(preview, ['Completed Doses'], 0));
    const missed = Number(getSummaryValue(preview, ['Missed Doses'], 0));
    const inProgress = Math.max(0, total - completed - missed);

    return [
      { label: 'Total PEP Schedules', value: total },
      { label: 'Completed PEP', value: completed },
      { label: 'In Progress', value: inProgress },
      { label: 'Missed/Overdue', value: missed },
      { label: 'Completion Rate', value: getSummaryValue(preview, ['Completion Rate'], '0%') },
    ];
  }

  if (reportType === 'inventory') {
    const expiringSoon = preview.rows.filter((row) => {
      const expiry = row[6];
      if (!expiry || expiry === '-') return false;
      const expiryDate = new Date(String(expiry));
      if (Number.isNaN(expiryDate.getTime())) return false;
      const days = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 60;
    }).length;

    return [
      { label: 'Total Inventory Items', value: getSummaryValue(preview, ['Total Items']) },
      { label: 'Low Stock Items', value: getSummaryValue(preview, ['Low Stock Items']) },
      { label: 'Critical Items', value: getSummaryValue(preview, ['Critical Items']) },
      { label: 'Expiring Soon Items', value: expiringSoon },
    ];
  }

  if (reportType === 'compliance') {
    const totalDoses = Number(getSummaryValue(preview, ['Total PEP Doses'], 0));
    const completed = Number(getSummaryValue(preview, ['Completed Doses'], 0));
    const missed = Number(getSummaryValue(preview, ['Missed Doses'], 0));

    return [
      { label: 'Total Patients Monitored', value: getSummaryValue(preview, ['Patients/Incidents Reviewed']) },
      { label: 'Completed', value: completed },
      { label: 'In Progress', value: Math.max(0, totalDoses - completed - missed) },
      { label: 'Missed Doses', value: missed },
      { label: 'Compliance Rate', value: getSummaryValue(preview, ['Overall Compliance'], '0%') },
    ];
  }

  return [
    { label: 'Total Incidents', value: getSummaryValue(preview, ['Total Incidents']) },
    { label: 'High-Risk Barangays', value: getSummaryValue(preview, ['High Risk Barangays']) },
    { label: 'Top Barangay', value: preview.rows[0]?.[0] ?? 'None' },
    { label: 'Top Animal Type', value: preview.rows[0]?.[3] ?? 'None' },
  ];
};

const getTablePreview = (preview: ReportPreview, reportType: string) => {
  if (reportType === 'monthly-incident') {
    return {
      headers: ['Date', 'Patient', 'Barangay', 'Animal Type', 'WHO Category', 'Status'],
      rows: preview.rows.map((row) => [row[0], row[1], row[3], row[4], row[6], row[7]]),
    };
  }

  if (reportType === 'annual-vaccination') {
    return {
      headers: ['Patient', 'Start Date', 'Current Dose', 'Status', 'Completion'],
      rows: preview.rows.map((row) => [row[1], row[0], row[3], row[4], row[4] === 'Done' ? 'Completed' : 'In Progress']),
    };
  }

  if (reportType === 'inventory') {
    return {
      headers: ['Item', 'Current Stock', 'Reorder Level', 'Nearest Expiry', 'Status'],
      rows: preview.rows.map((row) => [row[0], row[2] + ' ' + row[3], row[4], row[6], row[5]]),
    };
  }

  if (reportType === 'compliance') {
    return {
      headers: ['Patient', 'Dose Status', 'Last Dose', 'Next Due', 'Remarks'],
      rows: preview.rows.map((row) => {
        const compliance = parsePercent(row[6]);
        const status = compliance >= 100 ? 'Completed' : Number(row[5]) === 0 ? 'No PEP schedule' : 'In Progress';
        return [row[0], row[4] + '/' + row[5] + ' completed', row[2], '-', row[7] || status];
      }),
    };
  }

  return {
    headers: ['Barangay', 'Incidents', 'Top Animal', 'Risk Level', 'PEP Compliance'],
    rows: preview.rows.map((row) => [row[0], row[1], row[3], row[2], row[7]]),
  };
};

export function Reports() {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
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

  useEffect(() => {
    const loadBarangays = async () => {
      try {
        const response = await barangaysAPI.getAll();
        const options = ((response.data || []) as BarangayListItem[]).map((barangay) => ({
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
      toast.success(response.data.title + ' generated.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to generate report.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format: 'PDF' | 'Excel', config: ReportConfig = reportConfig) => {
    try {
      setDownloading(format);
      const result = await reportsAPI.download({ ...config, format });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(format + ' report downloaded: ' + result.filename);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to download report.'));
    } finally {
      setDownloading(null);
    }
  };

  const previewSummary = preview ? getPreviewSummary(preview, reportConfig.type) : [];
  const previewTable = preview ? getTablePreview(preview, reportConfig.type) : null;
  const visiblePreviewRowCount = previewTable?.rows.length ?? 0;

  return (
    <div className="flex-1">
      <Header title="Report Generation" breadcrumbs={['Reports', 'Generate']} />

      <div className="p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
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
                {preview ? (
                  <>
                    <div className="mb-6">
                      <h1 className="text-xl font-semibold text-foreground mb-1">{preview.title}</h1>
                      <p className="text-sm text-muted-foreground mb-0.5">Period: {preview.period}</p>
                      <p className="text-sm text-muted-foreground mb-0.5">Barangay: {preview.barangay}</p>
                      <p className="text-sm text-muted-foreground">Generated: {preview.generated_at}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                      {previewSummary.map((item) => (
                        <div key={item.label} className="border border-border rounded-lg px-4 py-3 bg-muted/20">
                          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                          <p className="text-lg font-semibold text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Preview Rows</h3>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleDownload('PDF')} disabled={downloading !== null}>
                          <Download className="w-4 h-4" />
                          PDF
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleDownload('Excel')} disabled={downloading !== null}>
                          <Download className="w-4 h-4" />
                          Excel
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto border border-border rounded-lg mb-4">
                      <table className="w-full min-w-[760px]">
                        <thead>
                          <tr className="bg-muted text-xs font-medium text-muted-foreground">
                            {previewTable?.headers.map((header) => (
                              <th key={header} className="text-left px-4 py-2">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {!previewTable || previewTable.rows.length === 0 ? (
                            <tr>
                              <td colSpan={previewTable?.headers.length || 1} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                No records found for the selected filters.
                              </td>
                            </tr>
                          ) : previewTable.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {visiblePreviewRowCount > 0 && (
                      <p className="text-xs text-muted-foreground text-center border-t border-border pt-4">
                        Showing first {visiblePreviewRowCount} of {preview.row_count} row{preview.row_count !== 1 ? 's' : ''}. Download includes the full report.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
                    <div>
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-bg text-primary">
                        <ClipboardList className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">{selectedType}</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        Configure report filters and click Generate Report to preview results.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-4">Report Configuration</h2>
              <div className="space-y-4">
                <Select
                  label="Report Type"
                  options={reportTypes}
                  value={reportConfig.type}
                  onChange={(event) => updateConfig({ type: event.target.value })}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
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
                </div>
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
                  <FileText className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>

            {preview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
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
          </aside>
        </div>
      </div>
    </div>
  );
}
