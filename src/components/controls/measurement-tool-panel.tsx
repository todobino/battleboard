'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ActiveTool, Measurement } from '@/types';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Ruler,Maximize } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MeasurementToolPanelProps {
  activeTool: ActiveTool;
  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  measurement: Measurement;
  setMeasurement: Dispatch<SetStateAction<Measurement>>;
}

export default function MeasurementToolPanel({
  activeTool, setActiveTool, measurement, setMeasurement
}: MeasurementToolPanelProps) {

  const handleToolSelect = (tool: 'measure_distance' | 'measure_radius') => {
    setActiveTool(tool);
    setMeasurement({ type: tool === 'measure_distance' ? 'distance' : 'radius' });
  };
  
  const clearMeasurement = () => {
    setMeasurement({ type: null });
    setActiveTool('select'); // Or keep the tool active for another measurement
  };

  return (
    <AccordionItem value="measurement-tool">
      <AccordionTrigger>
        <Ruler className="mr-2 h-5 w-5" /> Measurement Tools
      </AccordionTrigger>
      <AccordionContent className="space-y-4 p-1">
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
            <Maximize className="mr-2 h-4 w-4" /> Radius
          </Button>
        </div>
        {(activeTool === 'measure_distance' || activeTool === 'measure_radius') && (
          <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted">
            {measurement.startPoint && !measurement.endPoint ? "Click a second point on the grid to complete measurement." : "Click a starting point on the grid."}
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
      </AccordionContent>
    </AccordionItem>
  );
}
