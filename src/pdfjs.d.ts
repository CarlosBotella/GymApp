// La build «legacy» de pdf.js (compatible con Safari antiguos) no trae tipos propios.
declare module 'pdfjs-dist/legacy/build/pdf.min.mjs' {
  export * from 'pdfjs-dist';
}
