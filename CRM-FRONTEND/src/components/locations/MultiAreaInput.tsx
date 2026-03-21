import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Badge } from '@/ui/components/Badge';
import { FormItem, FormLabel, FormMessage, FormDescription } from '@/ui/components/Form';
import { cn } from '@/lib/utils';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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
    if (areas.length >= maxAreas) {return;}
    
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
    if (areas.length <= minAreas) {return;}
    
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
    if (!editingId || editingValue.trim().length < 2) {return;}
    
    // Check for duplicates
    const isDuplicate = areas.some(
      area => area.id !== editingId && area.name.toLowerCase() === editingValue.trim().toLowerCase()
    );
    
    if (isDuplicate) {return;}
    
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
    if (currentIndex === -1) {return;}
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= areas.length) {return;}
    
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
    if (!editingId || !editingValue.trim()) {return null;}
    
    const isDuplicate = areas.some(
      area => area.id !== editingId && area.name.toLowerCase() === editingValue.trim().toLowerCase()
    );
    
    return isDuplicate ? 'Area name already exists' : null;
  };

  const getValidationError = () => {
    if (!editingId || !editingValue.trim()) {return null;}
    
    if (editingValue.trim().length < 2) {
      return 'Area name must be at least 2 characters';
    }
    
    if (editingValue.trim().length > 100) {
      return 'Area name must be less than 100 characters';
    }
    
    return getDuplicateError();
  };

  return (
    <FormItem>
      <FormLabel>
        Areas ({areas.length}/{maxAreas})
      </FormLabel>

      <Stack gap={2} style={className ? undefined : undefined}>
        {areas.map((area, index) => (
          <Box
            key={area.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              border: `1px solid ${editingId === area.id ? 'var(--ui-success)' : 'var(--ui-border)'}`,
              borderRadius: 'var(--ui-radius-md)',
              background: editingId === area.id ? 'color-mix(in srgb, var(--ui-success) 8%, transparent)' : undefined,
            }}
          >
            {/* Reorder buttons */}
            <Stack gap={1}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => moveArea(area.id, 'up')}
                disabled={disabled || index === 0}
                style={{ padding: 0, minWidth: '1rem', minHeight: '1rem' }}
              >
                <ChevronUp size={12} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => moveArea(area.id, 'down')}
                disabled={disabled || index === areas.length - 1}
                style={{ padding: 0, minWidth: '1rem', minHeight: '1rem' }}
              >
                <ChevronDown size={12} />
              </Button>
            </Stack>

            {/* Area content */}
            <Box style={{ flex: 1 }}>
              {editingId === area.id ? (
                <Stack gap={1}>
                  <Input
                    ref={inputRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={saveEdit}
                    placeholder="Enter area name"
                    style={{
                      fontSize: '0.875rem',
                      borderColor: getValidationError() ? 'var(--ui-danger)' : undefined,
                    }}
                    maxLength={100}
                  />
                  {getValidationError() && (
                    <Text variant="caption" tone="danger">{getValidationError()}</Text>
                  )}
                </Stack>
              ) : (
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: disabled ? 'default' : 'pointer',
                    padding: '0.25rem',
                    borderRadius: 'var(--ui-radius-sm)',
                  }}
                  onClick={() => !disabled && startEditing(area)}
                >
                  <Stack direction="horizontal" gap={2} align="center">
                    <Badge variant="secondary">
                      {index + 1}
                    </Badge>
                    <Text as="span" variant="body-sm" style={{ fontWeight: 600 }}>{area.name || 'Unnamed Area'}</Text>
                  </Stack>
                </Box>
              )}
            </Box>

            {/* Remove button */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeArea(area.id)}
              disabled={disabled || areas.length <= minAreas}
              style={{ padding: 0, minWidth: '1.5rem', minHeight: '1.5rem', color: 'var(--ui-danger)' }}
            >
              <X size={12} />
            </Button>
          </Box>
        ))}

        {/* Add area button */}
        {areas.length < maxAreas && (
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={addArea}
            disabled={disabled}
            icon={<Plus size={16} />}
          >
            Add Area
          </Button>
        )}
      </Stack>

      <FormDescription>
        Add multiple areas/localities for this pincode. Click on an area to edit it.
        {areas.length >= maxAreas && (
          <Text as="span" variant="body-sm" tone="warning"> Maximum {maxAreas} areas allowed.</Text>
        )}
      </FormDescription>
      
      {error && <FormMessage>{error}</FormMessage>}
    </FormItem>
  );
}
