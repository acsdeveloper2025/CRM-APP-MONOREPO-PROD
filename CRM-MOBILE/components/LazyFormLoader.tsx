/**
 * Lazy Form Loader for CaseFlow Mobile
 * Dynamically loads verification forms to reduce initial bundle size
 */

import React, { Suspense, lazy } from 'react';

// Form loading fallback component
const FormLoader = () => (
  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
    <div className="flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full mx-auto mb-3"></div>
        <div className="text-light-text text-sm">Loading verification form...</div>
        <div className="text-gray-400 text-xs mt-1">Please wait</div>
      </div>
    </div>
  </div>
);

// Lazy load form components by category
const lazyForms = {
  // Residence Forms
  'residence-positive': lazy(() => import('./forms/residence/PositiveResidenceForm')),
  'residence-nsp': lazy(() => import('./forms/residence/NspResidenceForm')),
  'residence-shifted': lazy(() => import('./forms/residence/ShiftedResidenceForm')),
  'residence-entry-restricted': lazy(() => import('./forms/residence/EntryRestrictedResidenceForm')),
  'residence-untraceable': lazy(() => import('./forms/residence/UntraceableResidenceForm')),

  // Office Forms
  'office-positive': lazy(() => import('./forms/office/PositiveOfficeForm')),
  'office-nsp': lazy(() => import('./forms/office/NspOfficeForm')),
  'office-shifted': lazy(() => import('./forms/office/ShiftedOfficeForm')),
  'office-entry-restricted': lazy(() => import('./forms/office/EntryRestrictedOfficeForm')),
  'office-untraceable': lazy(() => import('./forms/office/UntraceableOfficeForm')),

  // Business Forms
  'business-positive': lazy(() => import('./forms/business/PositiveBusinessForm')),
  'business-nsp': lazy(() => import('./forms/business/NspBusinessForm')),
  'business-shifted': lazy(() => import('./forms/business/ShiftedBusinessForm')),
  'business-entry-restricted': lazy(() => import('./forms/business/EntryRestrictedBusinessForm')),
  'business-untraceable': lazy(() => import('./forms/business/UntraceableBusinessForm')),

  // Builder Forms
  'builder-positive': lazy(() => import('./forms/builder/PositiveBuilderForm')),
  'builder-nsp': lazy(() => import('./forms/builder/NspBuilderForm')),
  'builder-shifted': lazy(() => import('./forms/builder/ShiftedBuilderForm')),
  'builder-entry-restricted': lazy(() => import('./forms/builder/EntryRestrictedBuilderForm')),
  'builder-untraceable': lazy(() => import('./forms/builder/UntraceableBuilderForm')),

  // NOC Forms
  'noc-positive': lazy(() => import('./forms/noc/PositiveNocForm')),
  'noc-nsp': lazy(() => import('./forms/noc/NspNocForm')),
  'noc-shifted': lazy(() => import('./forms/noc/ShiftedNocForm')),
  'noc-entry-restricted': lazy(() => import('./forms/noc/EntryRestrictedNocForm')),
  'noc-untraceable': lazy(() => import('./forms/noc/UntraceableNocForm')),

  // Residence-cum-Office Forms
  'resi-cum-office-positive': lazy(() => import('./forms/residence-cum-office/PositiveResiCumOfficeForm')),
  'resi-cum-office-nsp': lazy(() => import('./forms/residence-cum-office/NspResiCumOfficeForm')),
  'resi-cum-office-shifted': lazy(() => import('./forms/residence-cum-office/ShiftedResiCumOfficeForm')),
  'resi-cum-office-entry-restricted': lazy(() => import('./forms/residence-cum-office/EntryRestrictedResiCumOfficeForm')),
  'resi-cum-office-untraceable': lazy(() => import('./forms/residence-cum-office/UntraceableResiCumOfficeForm')),

  // Property Individual Forms
  'property-individual-positive': lazy(() => import('./forms/property-individual/PositivePropertyIndividualForm')),
  'property-individual-nsp': lazy(() => import('./forms/property-individual/NspPropertyIndividualForm')),
  'property-individual-entry-restricted': lazy(() => import('./forms/property-individual/EntryRestrictedPropertyIndividualForm')),
  'property-individual-untraceable': lazy(() => import('./forms/property-individual/UntraceablePropertyIndividualForm')),

  // Property APF Forms
  'property-apf-positive-negative': lazy(() => import('./forms/property-apf/PositiveNegativePropertyApfForm')),
  'property-apf-entry-restricted': lazy(() => import('./forms/property-apf/EntryRestrictedPropertyApfForm')),
  'property-apf-untraceable': lazy(() => import('./forms/property-apf/UntraceablePropertyApfForm')),

  // DSA/DST Connector Forms
  'dsa-positive': lazy(() => import('./forms/dsa-dst-connector/PositiveDsaForm')),
  'dsa-nsp': lazy(() => import('./forms/dsa-dst-connector/NspDsaForm')),
  'dsa-shifted': lazy(() => import('./forms/dsa-dst-connector/ShiftedDsaForm')),
  'dsa-entry-restricted': lazy(() => import('./forms/dsa-dst-connector/EntryRestrictedDsaForm')),
  'dsa-untraceable': lazy(() => import('./forms/dsa-dst-connector/UntraceableDsaForm'))
};

export type FormType = keyof typeof lazyForms;

interface LazyFormLoaderProps {
  formType: FormType;
  [key: string]: any; // Allow passing through any props to the form
}

/**
 * LazyFormLoader Component
 * Dynamically loads and renders verification forms with loading fallback
 */
const LazyFormLoader: React.FC<LazyFormLoaderProps> = ({ formType, ...props }) => {
  const FormComponent = lazyForms[formType];

  if (!FormComponent) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
        <div className="text-red-400 text-sm">
          ❌ Form type "{formType}" not found
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<FormLoader />}>
      <FormComponent {...props} />
    </Suspense>
  );
};

/**
 * Get available form types for a category
 */
export const getFormTypesForCategory = (category: string): FormType[] => {
  return Object.keys(lazyForms).filter(key => key.startsWith(category)) as FormType[];
};

/**
 * Check if a form type exists
 */
export const isValidFormType = (formType: string): formType is FormType => {
  return formType in lazyForms;
};

/**
 * Get form display name from form type
 */
export const getFormDisplayName = (formType: FormType): string => {
  const parts = formType.split('-');
  const category = parts[0];
  const type = parts.slice(1).join(' ');
  
  const categoryNames: Record<string, string> = {
    'residence': 'Residence',
    'office': 'Office',
    'business': 'Business',
    'builder': 'Builder',
    'noc': 'NOC',
    'resi': 'Residence-cum-Office',
    'property': 'Property',
    'dsa': 'DSA/DST Connector'
  };

  const typeName = type.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return `${categoryNames[category] || category} - ${typeName}`;
};

export default LazyFormLoader;
