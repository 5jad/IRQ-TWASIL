/**
 * Generates 6 original synthesized Arabic maqam audio loops (<= 400 KB each, 20-24s)
 * saved under public/seed/audio/ using PCM synthesis piped to ffmpeg MP3 (48 kbps mono).
 * Zero external or copyrighted audio samples.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

interface MaqamTrackSpec {
  filename: string;
  title: string;
  maqam: string;
  durationSec: number;
  baseHz: number;
  scaleRatios: number[]; // harmonic intervals from baseHz
  tempoBpm: number;
  pattern: number[]; // indices into scaleRatios
}

const SAMPLE_RATE = 22050;

const TRACKS: MaqamTrackSpec[] = [
  {
    filename: 'rast.mp3',
    title: 'دجلة عند الغروب (راست)',
    maqam: 'Rast',
    durationSec: 20,
    baseHz: 261.63,
    scaleRatios: [1, 9 / 8, 1.224, 4 / 3, 3 / 2, 27 / 16, 1.834, 2],
    tempoBpm: 92,
    pattern: [0, 2, 4, 3, 2, 4, 5, 4, 3, 2, 1, 0, 4, 5, 7, 4],
  },
  {
    filename: 'nahawand.mp3',
    title: 'مقام نهاوند حديث',
    maqam: 'Nahawand',
    durationSec: 22,
    baseHz: 246.94,
    scaleRatios: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5, 2],
    tempoBpm: 100,
    pattern: [0, 2, 4, 5, 4, 3, 2, 1, 0, 4, 7, 5, 4, 2, 1, 0],
  },
  {
    filename: 'bayat.mp3',
    title: 'أهوار الجنوب (بيات)',
    maqam: 'Bayat',
    durationSec: 22,
    baseHz: 293.66,
    scaleRatios: [1, 1.09, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 16 / 9, 2],
    tempoBpm: 88,
    pattern: [0, 1, 3, 4, 3, 2, 1, 0, 3, 4, 5, 4, 3, 1, 0, 0],
  },
  {
    filename: 'saba.mp3',
    title: 'ليالي قلعة أربيل (صبا)',
    maqam: 'Saba',
    durationSec: 20,
    baseHz: 293.66,
    scaleRatios: [1, 1.09, 6 / 5, 1.26, 3 / 2, 8 / 5, 16 / 9, 2],
    tempoBpm: 84,
    pattern: [2, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2, 1, 0, 2, 0],
  },
  {
    filename: 'hijaz.mp3',
    title: 'إيقاع شارع المتنبي (حجاز)',
    maqam: 'Hijaz',
    durationSec: 24,
    baseHz: 293.66,
    scaleRatios: [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 9 / 5, 2],
    tempoBpm: 108,
    pattern: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 4, 3, 1, 0],
  },
  {
    filename: 'sikah.mp3',
    title: 'نخيل البصرة (سيكا)',
    maqam: 'Sikah',
    durationSec: 24,
    baseHz: 261.63,
    scaleRatios: [1, 1.125, 1.25, 1.375, 1.5, 1.667, 1.875, 2],
    tempoBpm: 94,
    pattern: [0, 1, 2, 4, 3, 2, 1, 0, 2, 4, 5, 4, 2, 1, 0, 0],
  },
];

function synthPcm16(spec: MaqamTrackSpec): Buffer {
  const totalSamples = SAMPLE_RATE * spec.durationSec;
  const pcm = new Int16Array(totalSamples);
  const beatSec = 60 / spec.tempoBpm;
  const stepSec = beatSec / 2; // eighth-note plucks

  for (let s = 0; s < totalSamples; s += 1) {
    const t = s / SAMPLE_RATE;
    const stepIdx = Math.floor(t / stepSec);
    const noteInStep = t - stepIdx * stepSec;
    const scaleIdx = spec.pattern[stepIdx % spec.pattern.length] ?? 0;
    const ratio = spec.scaleRatios[scaleIdx] ?? 1;
    const freq = spec.baseHz * ratio;

    // Oud-like plucked string envelope + harmonics
    const pluckEnv = Math.exp(-noteInStep * 6.5) * Math.min(1, noteInStep * 90);
    const lead =
      pluckEnv *
      (0.62 * Math.sin(2 * Math.PI * freq * t) +
        0.26 * Math.sin(2 * Math.PI * freq * 2 * t) +
        0.12 * Math.sin(2 * Math.PI * freq * 3 * t));

    // Warm root drone + fifth
    const drone =
      0.16 * Math.sin(2 * Math.PI * (spec.baseHz * 0.5) * t) +
      0.08 * Math.sin(2 * Math.PI * (spec.baseHz * 0.75) * t);

    // Subtle dum/tek percussive pulse every 2 steps
    const percTime = noteInStep;
    const isDum = stepIdx % 4 === 0;
    const isTek = stepIdx % 4 === 2;
    let perc = 0;
    if (isDum) {
      perc = 0.25 * Math.exp(-percTime * 18) * Math.sin(2 * Math.PI * 82 * percTime);
    } else if (isTek) {
      perc = 0.1 * Math.exp(-percTime * 35) * Math.sin(2 * Math.PI * 320 * percTime);
    }

    // Smooth 0.15s loop cross-fade at start and end
    let loopEnv = 1;
    if (t < 0.15) loopEnv = t / 0.15;
    else if (spec.durationSec - t < 0.15) loopEnv = (spec.durationSec - t) / 0.15;

    const mixed = Math.max(-0.92, Math.min(0.92, (lead * 0.58 + drone + perc) * loopEnv));
    pcm[s] = Math.round(mixed * 32767);
  }

  return Buffer.from(pcm.buffer);
}

const outDir = path.resolve(import.meta.dirname, '..', 'public', 'seed', 'audio');
fs.mkdirSync(outDir, { recursive: true });

let totalBytes = 0;
for (const track of TRACKS) {
  const pcmBuf = synthPcm16(track);
  const outPath = path.join(outDir, track.filename);
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f', 's16le',
      '-ar', String(SAMPLE_RATE),
      '-ac', '1',
      '-i', 'pipe:0',
      '-codec:a', 'libmp3lame',
      '-b:a', '48k',
      outPath,
    ],
    { input: pcmBuf, stdio: ['pipe', 'ignore', 'ignore'] }
  );
  const size = fs.statSync(outPath).size;
  totalBytes += size;
  console.log(`Generated ${track.filename}: ${(size / 1024).toFixed(1)} KB (${track.durationSec}s)`);
}
console.log(`Total audio size: ${(totalBytes / 1024).toFixed(1)} KB`);
