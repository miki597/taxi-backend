const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const pdfPath = path.join(__dirname, '../../frontend/public/pdfs/1. ORDENANZA REGULADORA.pdf');

console.log('Leyendo PDF:', pdfPath);

fs.readFile(pdfPath, (err, dataBuffer) => {
  if (err) {
    console.error('Error leyendo archivo:', err);
    return;
  }
  pdfParse(dataBuffer).then(function(data) {
    console.log('Texto extraído (primeros 500 caracteres):');
    console.log(data.text.substring(0, 500));
    console.log('\n✅ Total caracteres:', data.text.length);
  }).catch(function(error) {
    console.error('Error parseando PDF:', error);
  });
});
