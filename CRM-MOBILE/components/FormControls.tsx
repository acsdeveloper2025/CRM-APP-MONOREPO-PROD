import React from 'react';

const commonInputClasses = "shadow-sm appearance-none border border-dark-border rounded w-full py-2 px-3 bg-gray-700 text-light-text leading-tight focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:opacity-70 disabled:bg-gray-800 disabled:cursor-not-allowed";

const getReadOnlyClasses = (disabled?: boolean) =>
  disabled ? "bg-gray-800 text-gray-400 border-gray-600 cursor-not-allowed" : "";

interface FormFieldProps {
  label: string;
  id: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, id, className, disabled, ...props }) => (
  <div>
    <label htmlFor={id} className={`block text-sm font-medium mb-1 ${disabled ? 'text-gray-500' : 'text-medium-text'}`}>
      {label} {disabled && <span className="text-xs text-gray-500">(Read Only)</span>}
    </label>
    <input id={id} className={`${commonInputClasses} ${getReadOnlyClasses(disabled)} ${className || ''}`} disabled={disabled} {...props} />
  </div>
);

interface SelectFieldProps {
  label: string;
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({ label, id, disabled, ...props }) => (
  <div>
    <label htmlFor={id} className={`block text-sm font-medium mb-1 ${disabled ? 'text-gray-500' : 'text-medium-text'}`}>
      {label} {disabled && <span className="text-xs text-gray-500">(Read Only)</span>}
    </label>
    <select id={id} className={`${commonInputClasses} ${getReadOnlyClasses(disabled)}`} disabled={disabled} {...props} />
  </div>
);

interface TextAreaProps {
  label: string;
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export const TextAreaField: React.FC<TextAreaProps> = ({ label, id, rows = 3, disabled, ...props }) => (
  <div>
    <label htmlFor={id} className={`block text-sm font-medium mb-1 ${disabled ? 'text-gray-500' : 'text-medium-text'}`}>
      {label} {disabled && <span className="text-xs text-gray-500">(Read Only)</span>}
    </label>
    <textarea id={id} rows={rows} className={`${commonInputClasses} ${getReadOnlyClasses(disabled)}`} disabled={disabled} {...props} />
  </div>
);

interface NumberDropdownFieldProps {
  label: string;
  id: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  min: number;
  max: number;
  disabled?: boolean;
  placeholder?: string;
}

export const NumberDropdownField: React.FC<NumberDropdownFieldProps> = ({
  label,
  id,
  min,
  max,
  placeholder = "Select...",
  disabled,
  ...props
}) => {
  // Generate number options from min to max
  const numberOptions = [];
  for (let i = min; i <= max; i++) {
    numberOptions.push(
      <option key={i} value={i}>
        {i}
      </option>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={`block text-sm font-medium mb-1 ${disabled ? 'text-gray-500' : 'text-medium-text'}`}>
        {label} {disabled && <span className="text-xs text-gray-500">(Read Only)</span>}
      </label>
      <select id={id} className={`${commonInputClasses} ${getReadOnlyClasses(disabled)}`} disabled={disabled} {...props}>
        <option value="">{placeholder}</option>
        {numberOptions}
      </select>
    </div>
  );
};