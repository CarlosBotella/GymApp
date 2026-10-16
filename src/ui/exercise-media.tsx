import { useState } from 'react';
import type { Exercise } from '../lib/types';
import { Drawing } from './drawings';

export function exerciseImageUrl(image: string): string {
  return `${import.meta.env.BASE_URL}exercises/${image.split('/').map(encodeURIComponent).join('/')}`;
}

function Photo({ exercise, image, index, thumbnail = false }: { exercise: Exercise; image: string; index: number; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Drawing kind={exercise.kind} height={thumbnail ? 48 : 140} label={exercise.equipment} />;
  return <img src={exerciseImageUrl(image)} alt={`${exercise.name}: posición ${index + 1}`}
    loading="lazy" decoding="async" onError={() => setFailed(true)}
    style={{ display: 'block', width: '100%', height: thumbnail ? 52 : 'auto', maxHeight: thumbnail ? 52 : 280, objectFit: 'contain', background: '#fff', borderRadius: 4 }} />;
}

export function ExerciseThumb({ exercise }: { exercise: Exercise }) {
  const image = exercise.images?.[0];
  return <span style={{ display: 'block', width: 58, flex: '0 0 58px' }}>
    {image ? <Photo key={image} exercise={exercise} image={image} index={0} thumbnail /> : <Drawing kind={exercise.kind} height={48} />}
  </span>;
}

export function ExerciseGallery({ exercise }: { exercise: Exercise }) {
  if (!exercise.images?.length) return <Drawing kind={exercise.kind} height={140} label={exercise.name} />;
  return <figure style={{ margin: 0 }}>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(exercise.images.length, 2)}, minmax(0,1fr))`, gap: 8 }}>
      {exercise.images.slice(0, 2).map((image, index) => <div key={image}>
        <Photo exercise={exercise} image={image} index={index} />
        <p className="xs mute" style={{ textAlign: 'center', marginTop: 4 }}>Posición {index + 1}</p>
      </div>)}
    </div>
    <figcaption className="xs mute" style={{ marginTop: 8 }}>
      Imágenes estáticas de <a href={exercise.sourceUrl} target="_blank" rel="noopener noreferrer">Free Exercise DB</a> · Unlicense.
    </figcaption>
  </figure>;
}
