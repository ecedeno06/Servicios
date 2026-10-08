// Redimensiona una imagen al vuelo (canvas) y la devuelve como JPEG en
// base64 (data URI), para no guardar fotos de varios MB en la base de
// datos. Usado por el avatar de usuario y el logo de empresa.
export function redimensionarImagen(archivo: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(lector.error);
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.onload = () => {
        const escala = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}

// Lee un archivo tal cual (sin pasar por canvas) y lo devuelve como data URI
// base64 -- a diferencia de redimensionarImagen(), no recomprime ni
// redimensiona, asi que sirve tanto para PDF como para PNG/JPG cuando se
// quiere guardar el archivo exactamente como lo subio el usuario.
export function leerArchivoComoBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(lector.error);
    lector.onload = () => resolve(lector.result as string);
    lector.readAsDataURL(archivo);
  });
}
