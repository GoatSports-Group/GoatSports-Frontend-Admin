export type OwnerApplicationProgressState =
  | 'completed'
  | 'current'
  | 'upcoming'
  | 'rejected'
  | 'cancelled';

export type OwnerApplicationProgressTone = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type OwnerApplicationProgressStep = {
  title: string;
  description: string;
  state: OwnerApplicationProgressState;
  timestamp?: string;
};

export type OwnerApplicationProgress = {
  summary: string;
  detail: string;
  updatedAt?: string;
  tone: OwnerApplicationProgressTone;
  steps: OwnerApplicationProgressStep[];
};
