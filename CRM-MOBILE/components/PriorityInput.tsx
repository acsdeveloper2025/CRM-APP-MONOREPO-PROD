import React, { useState, useEffect } from 'react';
import { useCases } from '../context/CaseContext';

interface PriorityInputProps {
  caseId: string;
  className?: string;
}

const PriorityInput: React.FC<PriorityInputProps> = ({ caseId, className = '' }) => {
  const { getCasePriority, setCasePriority } = useCases();
  const [priority, setPriority] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const currentPriority = getCasePriority(caseId);
    setPriority(currentPriority ? currentPriority.toString() : '');
  }, [caseId, getCasePriority]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow positive integers
    if (value === '' || (/^\d+$/.test(value) && parseInt(value) > 0)) {
      setPriority(value);
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const numValue = priority === '' ? null : parseInt(priority);
    setCasePriority(caseId, numValue);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      // Reset to original value
      const currentPriority = getCasePriority(caseId);
      setPriority(currentPriority ? currentPriority.toString() : '');
      setIsEditing(false);
    }
  };

  const handleClearPriority = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPriority('');
    setCasePriority(caseId, null);
  };

  const currentPriorityValue = getCasePriority(caseId);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Priority Display/Input */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400 font-medium">Priority:</span>
        {isEditing ? (
          <input
            type="text"
            value={priority}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="w-12 px-1 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
            placeholder="1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className={`min-w-[24px] px-1 py-0.5 text-xs rounded transition-colors ${
              currentPriorityValue
                ? 'bg-blue-600 text-white font-semibold hover:bg-blue-500'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-dashed border-gray-500'
            }`}
          >
            {currentPriorityValue || '+'}
          </button>
        )}
      </div>

      {/* Clear Priority Button */}
      {currentPriorityValue && (
        <button
          onClick={handleClearPriority}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          title="Clear priority"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default PriorityInput;
