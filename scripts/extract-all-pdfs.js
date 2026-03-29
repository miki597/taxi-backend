const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const pdfFolder = path.join(__dirname, '../../frontend/public/pdfs');
const outputFolder = path.join(__dirname, '../../frontend/public/data/pdf-texts');

// Crear carpeta de salida si no existe
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder, { recursive: true });
}

const extractText = async () => {
  const files = fs.readdirSync(pdfFolder);
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));
  
  for (const pdfFile of pdfFiles) {
    console.log(`Procesando: ${pdfFile}`);
    try {
      const dataBuffer = fs.readFileSync(path.join(pdfFolder, pdfFile));
      const data = await pdfParse(dataBuffer);
      const text = data.text;
      
      const outputFile = pdfFile.replace('.pdf', '.txt');
      fs.writeFileSync(path.join(outputFolder, outputFile), text);
      console.log(`✅ Guardado: ${outputFile} (${text.length} caracteres)`);
    } catch (error) {
      console.error(`Error en ${pdfFile}:`, error.message);
    }
  }
  
  console.log('¡Extracción completada!');
};

extractText();
