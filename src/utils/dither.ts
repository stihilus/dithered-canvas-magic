export const colorPalettes = {
  'bw': ['#ffffff', '#000000'],
  'obra-dinn': ['#333319', '#e5ffff'],
  'cga': ['#ffffff', '#000000', '#58FFFB', '#EF2AF8', '#58FF4E', '#EE374B', '#FDFF52'],
  'amiga': ['#000020', '#D02020', '#0050A0', '#F0F0F0', '#F08000'],
  'rgb-dither': ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'],
  'cmyk-dither': ['#00ffff', '#ff00ff', '#ffff00', '#000000'],
  '3-bit-dither': ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'],
  'gameboy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  'teletext': ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'],
  'vaporwave': ['#FF6AD5', '#C774E8', '#AD8CFF', '#8795E8', '#94D0FF'],
  'hacker': ['#000000', '#00FF00']
};

export function hexToRgb(hex: string): [number, number, number] {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function findClosestColor(r: number, g: number, b: number, palette: string[]): [number, number, number] {
  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const color of palette) {
    const [pr, pg, pb] = hexToRgb(color);
    const distance = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return hexToRgb(closestColor);
}

export function applyDithering(
  imageData: ImageData,
  palette: string[],
  algorithm: 'ordered' | 'floyd-steinberg' | 'atkinson',
  size: number = 1
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;
  
  switch (algorithm) {
    case 'ordered':
      return applyOrderedDithering(data, width, height, palette, size);
    case 'floyd-steinberg':
      return applyFloydSteinbergDithering(data, width, height, palette, size);
    case 'atkinson':
      return applyAtkinsonDithering(data, width, height, palette, size);
    default:
      return imageData;
  }
}

function applyOrderedDithering(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: string[],
  size: number
): ImageData {
  const threshold = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const newData = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const idx = (y * width + x) * 4;
      const thresholdValue = threshold[(y / size) % 4][(x / size) % 4] / 16;

      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;

      const newR = r > thresholdValue ? 255 : 0;
      const newG = g > thresholdValue ? 255 : 0;
      const newB = b > thresholdValue ? 255 : 0;

      const [finalR, finalG, finalB] = findClosestColor(newR, newG, newB, palette);

      for (let dy = 0; dy < size && y + dy < height; dy++) {
        for (let dx = 0; dx < size && x + dx < width; dx++) {
          const currentIdx = ((y + dy) * width + (x + dx)) * 4;
          newData[currentIdx] = finalR;
          newData[currentIdx + 1] = finalG;
          newData[currentIdx + 2] = finalB;
          newData[currentIdx + 3] = 255;
        }
      }
    }
  }

  return new ImageData(newData, width, height);
}

function applyFloydSteinbergDithering(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: string[],
  size: number
): ImageData {
  const newData = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const idx = (y * width + x) * 4;
      const oldR = newData[idx];
      const oldG = newData[idx + 1];
      const oldB = newData[idx + 2];
      
      const [newR, newG, newB] = findClosestColor(oldR, oldG, oldB, palette);
      
      const errR = oldR - newR;
      const errG = oldG - newG;
      const errB = oldB - newB;

      // Distribute errors
      if (x + size < width) {
        newData[idx + 4 * size] += errR * 7/16;
        newData[idx + 4 * size + 1] += errG * 7/16;
        newData[idx + 4 * size + 2] += errB * 7/16;
      }
      if (y + size < height) {
        if (x - size >= 0) {
          newData[idx + width * 4 * size - 4 * size] += errR * 3/16;
          newData[idx + width * 4 * size - 4 * size + 1] += errG * 3/16;
          newData[idx + width * 4 * size - 4 * size + 2] += errB * 3/16;
        }
        newData[idx + width * 4 * size] += errR * 5/16;
        newData[idx + width * 4 * size + 1] += errG * 5/16;
        newData[idx + width * 4 * size + 2] += errB * 5/16;
        if (x + size < width) {
          newData[idx + width * 4 * size + 4 * size] += errR * 1/16;
          newData[idx + width * 4 * size + 4 * size + 1] += errG * 1/16;
          newData[idx + width * 4 * size + 4 * size + 2] += errB * 1/16;
        }
      }

      // Apply new color
      for (let dy = 0; dy < size && y + dy < height; dy++) {
        for (let dx = 0; dx < size && x + dx < width; dx++) {
          const currentIdx = ((y + dy) * width + (x + dx)) * 4;
          newData[currentIdx] = newR;
          newData[currentIdx + 1] = newG;
          newData[currentIdx + 2] = newB;
          newData[currentIdx + 3] = 255;
        }
      }
    }
  }

  return new ImageData(newData, width, height);
}

function applyAtkinsonDithering(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: string[],
  size: number
): ImageData {
  const newData = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const idx = (y * width + x) * 4;
      const oldR = newData[idx];
      const oldG = newData[idx + 1];
      const oldB = newData[idx + 2];
      
      const [newR, newG, newB] = findClosestColor(oldR, oldG, oldB, palette);
      
      const errR = (oldR - newR) / 8;
      const errG = (oldG - newG) / 8;
      const errB = (oldB - newB) / 8;

      const neighbors = [
        [1, 0], [2, 0],
        [-1, 1], [0, 1], [1, 1],
        [0, 2]
      ];

      // Distribute errors
      for (const [dx, dy] of neighbors) {
        const nx = x + dx * size;
        const ny = y + dy * size;
        if (nx >= 0 && nx < width && ny < height) {
          const nidx = (ny * width + nx) * 4;
          newData[nidx] += errR;
          newData[nidx + 1] += errG;
          newData[nidx + 2] += errB;
        }
      }

      // Apply new color
      for (let dy = 0; dy < size && y + dy < height; dy++) {
        for (let dx = 0; dx < size && x + dx < width; dx++) {
          const currentIdx = ((y + dy) * width + (x + dx)) * 4;
          newData[currentIdx] = newR;
          newData[currentIdx + 1] = newG;
          newData[currentIdx + 2] = newB;
          newData[currentIdx + 3] = 255;
        }
      }
    }
  }

  return new ImageData(newData, width, height);
}