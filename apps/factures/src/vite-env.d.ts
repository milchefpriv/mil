/// <reference types="vite/client" />

declare module "pdfmake/build/vfs_fonts.js" {
  const fonts: Record<string, string>;
  export default fonts;
}

declare module "pdfmake/build/vfs_fonts" {
  const fonts: Record<string, string>;
  export default fonts;
}
