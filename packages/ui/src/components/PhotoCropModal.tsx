import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../primitives';

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode_failed'));
    image.src = src;
  });
}

function cropBounds(image: HTMLImageElement, zoom: number, x: number, y: number) {
  const size = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  return {
    sx: (image.naturalWidth - size) * (x / 100),
    sy: (image.naturalHeight - size) * (y / 100),
    size,
  };
}

function drawCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  x: number,
  y: number,
  outputSize: number,
): void {
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas_unavailable');
  const bounds = cropBounds(image, zoom, x, y);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(image, bounds.sx, bounds.sy, bounds.size, bounds.size, 0, 0, outputSize, outputSize);
}

async function canvasToDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  for (const quality of [0.9, 0.82, 0.74, 0.66]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && (blob.size <= 350 * 1024 || quality === 0.66)) {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
        reader.readAsDataURL(blob);
      });
    }
  }
  throw new Error('encode_failed');
}

export function PhotoCropModal(props: {
  sourceUrl: string;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}): ReactNode {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadImage(props.sourceUrl).then(
      (loaded) => { if (!cancelled) setImage(loaded); },
      () => { if (!cancelled) setError(true); },
    );
    return () => { cancelled = true; };
  }, [props.sourceUrl]);

  useEffect(() => {
    if (image && canvasRef.current) drawCrop(canvasRef.current, image, zoom, x, y, 320);
  }, [image, zoom, x, y]);

  const confirm = async () => {
    if (!image) return;
    const canvas = document.createElement('canvas');
    drawCrop(canvas, image, zoom, x, y, 512);
    props.onConfirm(await canvasToDataUrl(canvas));
  };

  return (
    <Modal
      title={t('basics.photoCropTitle')}
      onClose={props.onClose}
      footer={
        <>
          <div className="ink-spacer" />
          <button className="ink-btn ink-btn-ghost" onClick={props.onClose}>{t('common.cancel')}</button>
          <button className="ink-btn ink-btn-primary" disabled={!image} onClick={() => void confirm()}>{t('common.apply')}</button>
        </>
      }
    >
      {error ? <div className="ink-inline-error">{t('basics.photoDecodeError')}</div> : (
        <>
          <canvas className="ink-photo-crop-canvas" ref={canvasRef} aria-label={t('basics.photoCropTitle')} />
          <label className="ink-photo-slider"><span>{t('basics.photoZoom')}</span><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          <label className="ink-photo-slider"><span>X</span><input type="range" min="0" max="100" value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
          <label className="ink-photo-slider"><span>Y</span><input type="range" min="0" max="100" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
        </>
      )}
    </Modal>
  );
}
