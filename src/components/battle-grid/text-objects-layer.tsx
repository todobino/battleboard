
'use client';

import type { TextObjectType, ActiveTool, Point } from '@/types';
import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { measureText } from '@/lib/geometry-utils'; // Assuming measureText is moved here

const TEXT_PADDING = { x: 8, y: 4 }; // Define constants used
const MIN_NEW_TEXT_INPUT_WIDTH = 150;


interface TextObjectsLayerProps {
  textObjects: TextObjectType[];
  editingTextObjectId: string | null;
  editingTextObjectContent: string;
  setEditingTextObjectContent: (text: string) => void;
  handleFinalizeTextEdit: () => void;
  handleTextEditInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  isCreatingText: { id: string; x: number; y: number; currentText: string; fontSize: number; inputWidth: number; } | null;
  setIsCreatingText: (state: TextObjectsLayerProps['isCreatingText'] | ((prevState: TextObjectsLayerProps['isCreatingText']) => TextObjectsLayerProps['isCreatingText'])) => void;
  finalizeTextCreation: () => void;
  handleTextInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  activeTool: ActiveTool;
  selectedTextObjectId: string | null;
  hoveredTextObjectId: string | null;
  setHoveredTextObjectId: (id: string | null) => void;
  draggingTextObjectId: string | null;
  rightClickPopoverStateActive: boolean;
}

export default function TextObjectsLayer({
  textObjects,
  editingTextObjectId,
  editingTextObjectContent,
  setEditingTextObjectContent,
  handleFinalizeTextEdit,
  handleTextEditInputKeyDown,
  isCreatingText,
  setIsCreatingText,
  finalizeTextCreation,
  handleTextInputKeyDown,
  activeTool,
  selectedTextObjectId,
  hoveredTextObjectId,
  setHoveredTextObjectId,
  draggingTextObjectId,
  rightClickPopoverStateActive,
}: TextObjectsLayerProps) {
  const textObjectEditInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingTextObjectId && textObjectEditInputRef.current) {
      const timerId = setTimeout(() => {
        textObjectEditInputRef.current?.focus();
        textObjectEditInputRef.current?.select();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [editingTextObjectId]);

  React.useEffect(() => {
    if (isCreatingText && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isCreatingText]);

  const handleTextInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isCreatingText) {
      const newText = event.target.value;
      const {width: textMetricsWidth} = measureText(newText || " ", isCreatingText.fontSize);
      const calculatedWidth = textMetricsWidth + TEXT_PADDING.x * 2 + 5;
      setIsCreatingText(prev => {
          if (!prev) return null;
          const newFinalWidth = Math.max(MIN_NEW_TEXT_INPUT_WIDTH, calculatedWidth);
          return { ...prev, currentText: newText, inputWidth: newFinalWidth };
      });
    }
  };

  return (
    <g>
      {textObjects.map(obj => {
        const isCurrentlyEditingThisText = editingTextObjectId === obj.id;
        return isCurrentlyEditingThisText ? (
          <foreignObject
            key={`edit-${obj.id}`}
            x={obj.x}
            y={obj.y}
            width={Math.max(obj.width, MIN_NEW_TEXT_INPUT_WIDTH)}
            height={obj.height + 2}
          >
            <input
              ref={textObjectEditInputRef}
              type="text"
              value={editingTextObjectContent}
              onChange={(e) => setEditingTextObjectContent(e.target.value)}
              onKeyDown={handleTextEditInputKeyDown}
              onBlur={handleFinalizeTextEdit}
              style={{
                width: '100%',
                height: '100%',
                padding: `${TEXT_PADDING.y}px ${TEXT_PADDING.x}px`,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                border: '1px solid hsl(var(--accent))',
                borderRadius: '8px',
                fontSize: `${obj.fontSize}px`,
                fontFamily: 'sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onWheelCapture={(e) => e.stopPropagation()}
            />
          </foreignObject>
        ) : (
          <foreignObject
            key={obj.id}
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            className={cn(
              activeTool === 'select' && !editingTextObjectId && !rightClickPopoverStateActive ? 'cursor-pointer' :
              activeTool === 'type_tool' ? 'cursor-text' : 'cursor-default',
              draggingTextObjectId === obj.id && !editingTextObjectId ? 'cursor-grabbing' : ''
            )}
            onMouseEnter={() => {
              if (activeTool === 'type_tool') {
                setHoveredTextObjectId(obj.id);
              }
            }}
            onMouseLeave={() => {
              if (activeTool === 'type_tool') {
                setHoveredTextObjectId(null);
              }
            }}
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'white',
                padding: `${TEXT_PADDING.y}px ${TEXT_PADDING.x}px`,
                borderRadius: '8px',
                fontSize: `${obj.fontSize}px`,
                fontFamily: 'sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                boxSizing: 'border-box',
                border: (selectedTextObjectId === obj.id && activeTool !== 'type_tool') ? '1px solid hsl(var(--ring))' :
                        (activeTool === 'type_tool' && hoveredTextObjectId === obj.id ? '1px solid hsl(var(--accent))' : 'none'),
              }}
            >
              {obj.content}
            </div>
          </foreignObject>
        );
      })}

      {isCreatingText && (() => {
        const textForInitialHeight = isCreatingText.currentText.trim() === '' ? 'M' : isCreatingText.currentText;
        const { height: measuredContentHeight } = measureText(textForInitialHeight, isCreatingText.fontSize);
        const bubbleHeight = measuredContentHeight + TEXT_PADDING.y * 2;

        return (
          <foreignObject
            x={isCreatingText.x}
            y={isCreatingText.y - bubbleHeight / 2}
            width={isCreatingText.inputWidth}
            height={bubbleHeight + 2}
          >
            <input
              ref={textInputRef}
              type="text"
              value={isCreatingText.currentText}
              onChange={handleTextInputChange}
              onKeyDown={handleTextInputKeyDown}
              onBlur={finalizeTextCreation}
              style={{
                width: '100%',
                height: '100%',
                padding: `${TEXT_PADDING.y}px ${TEXT_PADDING.x}px`,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                border: '1px solid hsl(var(--accent))',
                borderRadius: '8px',
                fontSize: `${isCreatingText.fontSize}px`,
                fontFamily: 'sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onWheelCapture={(e) => e.stopPropagation()}
            />
          </foreignObject>
        );
      })()}
    </g>
  );
}
