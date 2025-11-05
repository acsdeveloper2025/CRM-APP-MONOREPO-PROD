/**
 * Standardized Badge Styling Utility
 * 
 * This file provides consistent badge styling across the entire CRM application.
 * All badges should use green background with white text and uppercase labels.
 */

import { twMerge } from 'tailwind-merge';

/**
 * Base badge style - green background, white text, uppercase
 */
export const baseBadgeStyle = 'bg-green-600 text-white hover:bg-green-700 uppercase font-medium';

/**
 * Get standardized status badge styling
 * All status badges use green background with white text
 */
export function getStatusBadgeStyle(_status?: string): string {
  return twMerge(baseBadgeStyle, 'text-xs');
}

/**
 * Get standardized priority badge styling
 * All priority badges use green background with white text
 */
export function getPriorityBadgeStyle(_priority?: number | string): string {
  return twMerge(baseBadgeStyle, 'text-xs');
}

/**
 * Get standardized verification type badge styling
 * All verification type badges use green background with white text
 */
export function getVerificationTypeBadgeStyle(_type?: string): string {
  return twMerge(baseBadgeStyle, 'text-xs');
}

/**
 * Get standardized task status badge styling
 * All task status badges use green background with white text
 */
export function getTaskStatusBadgeStyle(_status?: string): string {
  return twMerge(baseBadgeStyle, 'text-xs');
}

/**
 * Get standardized task priority badge styling
 * All task priority badges use green background with white text
 */
export function getTaskPriorityBadgeStyle(_priority?: string): string {
  return twMerge(baseBadgeStyle, 'text-xs');
}

/**
 * Format badge label to uppercase
 */
export function formatBadgeLabel(label: string | number | undefined): string {
  if (label === undefined || label === null) {return 'N/A';}
  return String(label).toUpperCase().replace('_', ' ');
}

/**
 * Get priority label in uppercase
 */
export function getPriorityLabel(priority: number | string): string {
  if (typeof priority === 'string') {
    return priority.toUpperCase();
  }

  const labels: Record<number, string> = {
    1: 'LOW',
    2: 'MEDIUM',
    3: 'HIGH',
    4: 'URGENT',
    5: 'CRITICAL',
  };

  return labels[priority] || 'UNKNOWN';
}

/**
 * Get status label in uppercase
 */
export function getStatusLabel(status: string): string {
  return status.toUpperCase().replace('_', ' ');
}

