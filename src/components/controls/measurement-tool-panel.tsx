
'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Measurement, MeasurementToolPanelProps as MeasurementToolPanelPropsType } from '@/types';
import { Button } from '@/components/ui/button';
import { Ruler, Radius } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MeasurementToolPanelProps extends MeasurementToolPanelPropsType {}

export default function MeasurementToolPanel({
  activeTool, setActiveTool, measurement, setMeasurement
}: MeasurementToolPanelProps) {

  const handleToolSelect = (tool: 'measure_distance' | 'measure_radius') => {
    setActiveTool(tool);
    setMeasurement({ type: tool, startPoint: undefined, endPoint: undefined, result: undefined });
    // Popover closing is now handled by SideToolbar's useEffect
  };

  const clearMeasurement = () => {
    setMeasurement({ type: null, startPoint: undefined, endPoint: undefined, result: undefined });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={activeTool === 'measure_distance' ? "default" : "outline"}
          onClick={() => handleToolSelect('measure_distance')}
        >
          <Ruler className="mr-2 h-4 w-4" /> Distance
        </Button>
        <Button
          variant={activeTool === 'measure_radius' ? "default" : "outline"}
          onClick={() => handleToolSelect('measure_radius')}
        >
          <Radius className="mr-2 h-4 w-4" /> Radius
        </Button>
      </div>
      {(activeTool === 'measure_distance' || activeTool === 'measure_radius') && (
        <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted">
          Click and drag on the grid to measure.
        </p>
      )}
      {measurement.result && (
         <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-base">Measurement Result</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm font-semibold">{measurement.result}</p>
            <Button onClick={clearMeasurement} variant="outline" size="sm" className="mt-2 w-full">Clear Measurement</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
