import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  Calendar,
  Filter,
  Settings,
  Mail,
  Clock,
  CheckCircle
} from 'lucide-react';

interface ExportConfig {
  format: 'csv' | 'excel' | 'pdf' | 'json';
  dateRange: { from: string; to: string };
  dataTypes: string[];
  filters: Record<string, any>;
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
}

export const DataExportReporting: React.FC = () => {
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'csv',
    dateRange: { 
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    },
    dataTypes: ['form-submissions'],
    filters: {},
    schedule: {
      enabled: false,
      frequency: 'weekly',
      recipients: []
    }
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState([
    {
      id: '1',
      name: 'Form Submissions Report',
      format: 'excel',
      createdAt: '2024-01-15T10:30:00Z',
      size: '2.4 MB',
      status: 'completed',
      downloadUrl: '#'
    },
    {
      id: '2',
      name: 'Agent Performance Analysis',
      format: 'pdf',
      createdAt: '2024-01-14T15:45:00Z',
      size: '1.8 MB',
      status: 'completed',
      downloadUrl: '#'
    },
    {
      id: '3',
      name: 'Case Analytics Dashboard',
      format: 'csv',
      createdAt: '2024-01-13T09:15:00Z',
      size: '856 KB',
      status: 'completed',
      downloadUrl: '#'
    }
  ]);

  const dataTypeOptions = [
    { id: 'form-submissions', label: 'Form Submissions', description: 'All form submission data with validation status' },
    { id: 'case-analytics', label: 'Case Analytics', description: 'Case progress, completion times, and status data' },
    { id: 'agent-performance', label: 'Agent Performance', description: 'Agent productivity and quality metrics' },
    { id: 'validation-status', label: 'Validation Status', description: 'Form validation trends and statistics' },
    { id: 'completion-times', label: 'Completion Times', description: 'Case completion time analysis' },
    { id: 'status-distribution', label: 'Status Distribution', description: 'Case status breakdown and trends' }
  ];

  const formatOptions = [
    { value: 'csv', label: 'CSV', icon: FileText, description: 'Comma-separated values for spreadsheet applications' },
    { value: 'excel', label: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel format with charts and formatting' },
    { value: 'pdf', label: 'PDF', icon: FileImage, description: 'Formatted report with charts and visualizations' },
    { value: 'json', label: 'JSON', icon: FileText, description: 'Raw data in JSON format for API integration' }
  ];

  const handleExport = async () => {
    setIsExporting(true);
    
    // Simulate export process
    setTimeout(() => {
      const newExport = {
        id: Date.now().toString(),
        name: `Custom Report - ${exportConfig.dataTypes.join(', ')}`,
        format: exportConfig.format,
        createdAt: new Date().toISOString(),
        size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`,
        status: 'completed' as const,
        downloadUrl: '#'
      };
      
      setExportHistory([newExport, ...exportHistory]);
      setIsExporting(false);
    }, 3000);
  };

  const handleDataTypeChange = (dataType: string, checked: boolean) => {
    if (checked) {
      setExportConfig(prev => ({
        ...prev,
        dataTypes: [...prev.dataTypes, dataType]
      }));
    } else {
      setExportConfig(prev => ({
        ...prev,
        dataTypes: prev.dataTypes.filter(type => type !== dataType)
      }));
    }
  };

  const getFormatIcon = (format: string) => {
    const option = formatOptions.find(opt => opt.value === format);
    return option ? option.icon : FileText;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Export & Reporting</h2>
          <p className="mt-1 text-muted-foreground">
            Export analytics data and generate custom reports
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Data Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Data Selection</CardTitle>
              <CardDescription>Choose the data types to include in your export</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dataTypeOptions.map((option) => (
                <div key={option.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id={option.id}
                    checked={exportConfig.dataTypes.includes(option.id)}
                    onCheckedChange={(checked) => handleDataTypeChange(option.id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={option.id} className="font-medium cursor-pointer">
                      {option.label}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Export Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Export Settings</CardTitle>
              <CardDescription>Configure format and date range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Format Selection */}
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select 
                  value={exportConfig.format} 
                  onValueChange={(value: any) => setExportConfig(prev => ({ ...prev, format: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          <option.icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {formatOptions.find(opt => opt.value === exportConfig.format)?.description}
                </p>
              </div>

              {/* Date Range */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">From Date</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={exportConfig.dateRange.from}
                    onChange={(e) => setExportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, from: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo">To Date</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={exportConfig.dateRange.to}
                    onChange={(e) => setExportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, to: e.target.value }
                    }))}
                  />
                </div>
              </div>

              {/* Export Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting || exportConfig.dataTypes.length === 0}
                  className="w-full"
                >
                  {isExporting ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Generating Export...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate Export
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>Automate regular data exports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enableSchedule"
                  checked={exportConfig.schedule?.enabled}
                  onCheckedChange={(checked) => setExportConfig(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule!, enabled: checked as boolean }
                  }))}
                />
                <Label htmlFor="enableSchedule">Enable scheduled reports</Label>
              </div>

              {exportConfig.schedule?.enabled && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select 
                      value={exportConfig.schedule.frequency} 
                      onValueChange={(value: any) => setExportConfig(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule!, frequency: value }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipients">Email Recipients</Label>
                    <Input
                      id="recipients"
                      placeholder="Enter email addresses separated by commas"
                      value={exportConfig.schedule.recipients.join(', ')}
                      onChange={(e) => setExportConfig(prev => ({
                        ...prev,
                        schedule: { 
                          ...prev.schedule!, 
                          recipients: e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                        }
                      }))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Export History & Quick Actions */}
        <div className="space-y-6">
          {/* Quick Export Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Exports</CardTitle>
              <CardDescription>Pre-configured export templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Weekly Performance Report
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Monthly Form Submissions
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileImage className="h-4 w-4 mr-2" />
                Agent Analytics Dashboard
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Case Completion Summary
              </Button>
            </CardContent>
          </Card>

          {/* Export History */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Exports</CardTitle>
              <CardDescription>Download or view previous exports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {exportHistory.map((exportItem) => {
                const IconComponent = getFormatIcon(exportItem.format);
                
                return (
                  <div key={exportItem.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <IconComponent className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">{exportItem.name}</span>
                      </div>
                      <Badge className={getStatusColor(exportItem.status)}>
                        {exportItem.status}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Size: {exportItem.size}</div>
                      <div>
                        Created: {new Date(exportItem.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {exportItem.status === 'completed' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => window.open(exportItem.downloadUrl, '_blank')}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Export Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Export Statistics</CardTitle>
              <CardDescription>Usage metrics and insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Exports:</span>
                  <span className="font-medium">47</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">This Month:</span>
                  <span className="font-medium">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Most Popular:</span>
                  <span className="font-medium">Excel</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Size:</span>
                  <span className="font-medium">156 MB</span>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground mb-2">Format Distribution:</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Excel</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                      </div>
                      <span>60%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>PDF</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '25%' }}></div>
                      </div>
                      <span>25%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>CSV</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '15%' }}></div>
                      </div>
                      <span>15%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
