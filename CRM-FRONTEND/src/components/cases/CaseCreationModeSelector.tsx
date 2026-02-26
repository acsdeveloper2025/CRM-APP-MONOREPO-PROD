import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Users, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  ArrowRight,
  FileText,
  Target
} from 'lucide-react';

interface CaseCreationModeSelectorProps {
  onSelectMode: (mode: 'single-task' | 'multi-task') => void;
}

export const CaseCreationModeSelector: React.FC<CaseCreationModeSelectorProps> = ({
  onSelectMode
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">Choose Case Creation Mode</h2>
        <p className="text-gray-600 mt-2">
          Select how you want to create your verification case
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Single Task Mode */}
        <Card className="relative hover:shadow-lg transition-shadow cursor-pointer group">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Single Task Case</CardTitle>
                <Badge variant="secondary" className="mt-1">Traditional</Badge>
              </div>
            </div>
            <CardDescription className="text-base">
              Create a case with one verification task - the standard approach
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>One verification type per case</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-green-600" />
                <span>Single field user assignment</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span>Quick and simple setup</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span>Single rate calculation</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-3">
                <strong>Best for:</strong> Simple verifications, single document checks, 
                standard residence/office verifications
              </p>
              <Button 
                onClick={() => onSelectMode('single-task')}
                className="w-full group-hover:bg-primary/90"
              >
                Create Single Task Case
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Multi Task Mode */}
        <Card className="relative hover:shadow-lg transition-shadow cursor-pointer group border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Multi-Task Case</CardTitle>
                <Badge variant="default" className="mt-1">Enhanced</Badge>
              </div>
            </div>
            <CardDescription className="text-base">
              Create a case with multiple verification tasks - advanced workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-primary" />
                <span>Multiple verification types</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>Different field users per task</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span>Individual task tracking</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span>Per-task billing & rates</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-3">
                <strong>Best for:</strong> Complex verifications, multiple documents, 
                different locations, comprehensive background checks
              </p>
              <Button 
                onClick={() => onSelectMode('multi-task')}
                className="w-full group-hover:bg-primary/90"
                variant="default"
              >
                Create Multi-Task Case
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Comparison */}
      <Card className="bg-slate-100/50 dark:bg-slate-800/40">
        <CardHeader>
          <CardTitle className="text-lg">Feature Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Feature</th>
                  <th className="text-center py-2">Single Task</th>
                  <th className="text-center py-2">Multi-Task</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                <tr className="border-b">
                  <td className="py-2">Verification Types</td>
                  <td className="text-center py-2">
                    <Badge variant="outline">1</Badge>
                  </td>
                  <td className="text-center py-2">
                    <Badge variant="default">Multiple</Badge>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Field User Assignment</td>
                  <td className="text-center py-2">
                    <Badge variant="outline">Single</Badge>
                  </td>
                  <td className="text-center py-2">
                    <Badge variant="default">Per Task</Badge>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Progress Tracking</td>
                  <td className="text-center py-2">
                    <Badge variant="outline">Case Level</Badge>
                  </td>
                  <td className="text-center py-2">
                    <Badge variant="default">Task Level</Badge>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Billing Granularity</td>
                  <td className="text-center py-2">
                    <Badge variant="outline">Per Case</Badge>
                  </td>
                  <td className="text-center py-2">
                    <Badge variant="default">Per Task</Badge>
                  </td>
                </tr>
                <tr>
                  <td className="py-2">Setup Complexity</td>
                  <td className="text-center py-2">
                    <Badge variant="outline">Simple</Badge>
                  </td>
                  <td className="text-center py-2">
                    <Badge variant="secondary">Advanced</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-gray-600">
        <p>
          💡 <strong>Tip:</strong> You can always add more verification tasks to a single-task case later, 
          but multi-task cases provide better organization from the start.
        </p>
      </div>
    </div>
  );
};
