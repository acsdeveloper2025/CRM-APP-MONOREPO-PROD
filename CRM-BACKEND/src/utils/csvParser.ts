import csv from 'csv-parser';
import { Readable } from 'stream';

export interface CSVRow {
  [key: string]: string;
}

/**
 * Parse CSV buffer into array of objects
 */
export const parseCSV = (buffer: Buffer): Promise<CSVRow[]> => {
  return new Promise((resolve, reject) => {
    const results: CSVRow[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csv())
      .on('data', (data: CSVRow) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', error => reject(error));
  });
};

/**
 * Validate required fields in CSV row
 */
export const validateCSVRow = (row: CSVRow, requiredFields: string[]): string | null => {
  for (const field of requiredFields) {
    if (!row[field] || row[field].trim() === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
};
