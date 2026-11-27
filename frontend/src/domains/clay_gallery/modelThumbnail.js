export async function modelThumbnail(viewer) {
  const snapshot = await viewer.toBlob({ mimeType: 'image/png', idealAspect: true });
  const image = await createImageBitmap(snapshot);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let left = image.width;
    let right = -1;
    let top = image.height;
    let bottom = -1;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        if (data[(y * image.width + x) * 4 + 3] <= 32) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left) throw new Error('The thumbnail is empty.');
    const width = right - left + 1;
    const height = bottom - top + 1;
    const size = 320;
    const scale = (size * 0.84) / Math.max(width, height);
    canvas.width = canvas.height = size;
    context.drawImage(image, left, top, width, height,
      (size - width * scale) / 2, (size - height * scale) / 2, width * scale, height * scale);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((data) => data ? resolve(data) : reject(new Error('Could not render a thumbnail.')),
        'image/png');
    });
  } finally {
    image.close();
  }
}
