import { promises as fs } from 'fs';
import path from 'path';
import { extractPdfLocally } from '@/services/pdfLocalExtractor';

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: ts-node scripts/test-local-pdf-extract.ts <path-to-pdf>');
    process.exit(1);
  }

  const buffer = await fs.readFile(path.resolve(pdfPath));
  const result = await extractPdfLocally(buffer, {
    clientName: 'TEST CLIENT',
    productName: 'TEST PRODUCT',
    dataEntryFields: [
      { fieldKey: 'pickup_criteria', fieldLabel: 'Pick Up Criteria', fieldType: 'text' },
      { fieldKey: 'rcu_status', fieldLabel: 'RCU Status', fieldType: 'select' },
      { fieldKey: 'overall_remarks', fieldLabel: 'Overall Remarks', fieldType: 'textarea' },
    ],
  });

  const outPath = '/tmp/local-extract-output.html';
  await fs.writeFile(outPath, result.html, 'utf8');
  console.log('---');
  console.log('PDF:', pdfPath);
  console.log('Pages:', result.pagesCount);
  console.log('Text items (cells):', result.textItemsCount);
  console.log('HTML bytes:', Buffer.byteLength(result.html, 'utf8'));
  console.log('Elapsed:', result.elapsedMs, 'ms');
  console.log('Saved:', outPath);
  console.log('---');
  console.log('First 1200 chars of HTML:');
  console.log(result.html.slice(0, 1200));
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
