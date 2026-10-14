import { AiVerdict } from '@application/dto/moderation/moderation.dto';

const LABELS: Record<string, string> = {
  NONE: 'Không vi phạm',
  SPAM: 'Spam',
  HARASSMENT: 'Xúc phạm',
  HATE: 'Thù ghét',
  SEXUAL: 'Tình dục',
  VIOLENCE: 'Bạo lực',
  SCAM: 'Lừa đảo',
  OTHER: 'Khác'
};

/** Mức 0–3 → tone badge: không vi phạm là trung tính (AI không "duyệt" nội dung), nặng là danger. */
const TONES = ['neutral', 'info', 'warning', 'danger'] as const;

/** "AI: Lừa đảo". */
export function aiVerdictLabel(verdict: AiVerdict): string {
  return `AI: ${LABELS[verdict.label] ?? verdict.label}`;
}

export function aiVerdictTone(verdict: AiVerdict): (typeof TONES)[number] {
  return TONES[Math.min(Math.max(verdict.severity ?? 0, 0), 3)];
}
