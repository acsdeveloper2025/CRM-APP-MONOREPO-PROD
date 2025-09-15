import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { cn } from '@/lib/utils';

export interface AreaItem {
  id: string;
  name: string;
  displayOrder: number;
  isNew?: boolean;
}

interface MultiAreaInputProps {
  areas: AreaItem[];
  onChange: (areas: AreaItem[]) => void;
  error?: string;
  maxAreas?: number;
  minAreas?: number;
  className?: string;
  disabled?: boolean;
}

export function MultiAreaInput({
  areas,
  onChange,
  error,
  maxAreas = 15,
  minAreas = 1,
  className,
  disabled = false,
}: MultiAreaInputProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const addArea = () => {
    if (areas.length >= maxAreas) return;
    
    const newArea: AreaItem = {
      id: `new-${Date.now()}`,
      name: '',
      displayOrder: areas.length + 1,
      isNew: true,
    };
    
    const updatedAreas = [...areas, newArea];
    onChange(updatedAreas);
    setEditingId(newArea.id);
    setEditingValue('');
  };

  const removeArea = (id: string) => {
    if (areas.length <= minAreas) return;
    
    const updatedAreas = areas
      .filter(area => area.id !== id)
      .map((area, index) => ({
        ...area,
        displayOrder: index + 1,
      }));
    
    onChange(updatedAreas);
    
    if (editingId === id) {
      setEditingId(null);
      setEditingValue('');
    }
  };

  const startEditing = (area: AreaItem) => {
    setEditingId(area.id);
    setEditingValue(area.name);
  };

  const saveEdit = () => {
    if (!editingId || editingValue.trim().length < 2) return;
    
    // Check for duplicates
    const isDuplicate = areas.some(
      area => area.id !== editingId && area.name.toLowerCase() === editingValue.trim().toLowerCase()
    );
    
    if (isDuplicate) return;
    
    const updatedAreas = areas.map(area =>
      area.id === editingId
        ? { ...area, name: editingValue.trim(), isNew: false }
        : area
    );
    
    onChange(updatedAreas);
    setEditingId(null);
    setEditingValue('');
  };

  const cancelEdit = () => {
    if (editingId) {
      const area = areas.find(a => a.id === editingId);
      if (area?.isNew) {
        removeArea(editingId);
      }
    }
    setEditingId(null);
    setEditingValue('');
  };

  const moveArea = (id: string, direction: 'up' | 'down') => {
    const currentIndex = areas.findIndex(area => area.id === id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= areas.length) return;
    
    const updatedAreas = [...areas];
    [updatedAreas[currentIndex], updatedAreas[newIndex]] = [updatedAreas[newIndex], updatedAreas[currentIndex]];
    
    // Update display orders
    updatedAreas.forEach((area, index) => {
      area.displayOrder = index + 1;
    });
    
    onChange(updatedAreas);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const getDuplicateError = () => {
    if (!editingId || !editingValue.trim()) return null;
    
    const isDuplicate = areas.some(
      area => area.id !== editingId && area.name.toLowerCase() === editingValue.trim().toLowerCase()
    );
    
    return isDuplicate ? 'Area name already exists' : null;
  };

  const getValidationError = () => {
    if (!editingId || !editingValue.trim()) return null;
    
    if (editingValue.trim().length < 2) {
      return 'Area name must be at least 2 characters';
    }
    
    if (editingValue.trim().length > 100) {
      return 'Area name must be less than 100 characters';
    }
    
    return getDuplicateError();
  };

  return (
    <FormItem className={className}>
      <FormLabel>
        Areas ({areas.length}/{maxAreas})
      </FormLabel>
      
      <div className="space-y-2">
        {areas.map((area, index) => (
          <div
            key={area.id}
            className={cn(
              "flex items-center gap-2 p-2 border rounded-md",
              editingId === area.id ? "border-blue-500 bg-blue-50" : "border-border"
            )}
          >
            {/* Reorder buttons */}
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => moveArea(area.id, 'up')}
                disabled={disabled || index === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => moveArea(area.id, 'down')}
                disabled={disabled || index === areas.length - 1}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>

            {/* Area content */}
            <div className="flex-1">
              {editingId === area.id ? (
                <div className="space-y-1">
                  <Input
                    ref={inputRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={saveEdit}
                    placeholder="Enter area name"
                    className={cn(
                      "text-sm",
                      getValidationError() ? "border-red-500" : ""
                    )}
                    maxLength={100}
                  />
                  {getValidationError() && (
                    <p className="text-xs text-red-500">{getValidationError()}</p>
                  )}
                </div>
              ) : (
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-muted p-1 rounded"
                  onClick={() => !disabled && startEditing(area)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium">{area.name || 'Unnamed Area'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Remove button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => removeArea(area.id)}
              disabled={disabled || areas.length <= minAreas}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}

        {/* Add area button */}
        {areas.length < maxAreas && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addArea}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Area
          </Button>
        )}
      </div>

      <FormDescription>
        Add multiple areas/localities for this pincode. Click on an area to edit it.
        {areas.length >= maxAreas && (
          <span className="text-amber-600"> Maximum {maxAreas} areas allowed.</span>
        )}
      </FormDescription>
      
      {error && <FormMessage>{error}</FormMessage>}
    </FormItem>
  );
}
