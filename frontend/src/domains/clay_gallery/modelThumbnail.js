export async function modelThumbnail(viewer) {
  const snapshot = await viewer.toBlob({ mimeType: 'image/png', idealAspect: true });
  const image = await createImageBitmap(snapshot);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 320 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#292b2e';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((data) => data ? resolve(data) : reject(new Error('Could not render a thumbnail.')),
        'image/jpeg', 0.82);
    });
  } finally {
    image.close();
  }
}
