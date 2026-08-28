import type { ExperimentStatus } from "./types";

const EXPERIMENT_TRANSITIONS: Readonly<
  Record<ExperimentStatus, readonly ExperimentStatus[]>
> = {
  planned: ["active", "archived"],
  active: ["planned", "complete", "archived"],
  complete: ["active", "finalized", "archived"],
  finalized: ["archived"],
  archived: [],
};

export function allowedExperimentTransitions(
  status: ExperimentStatus
): readonly ExperimentStatus[] {
  return EXPERIMENT_TRANSITIONS[status];
}

export function canTransitionExperimentStatus(
  from: ExperimentStatus,
  to: ExperimentStatus
) {
  return from === to || EXPERIMENT_TRANSITIONS[from].includes(to);
}

export function assertExperimentStatusTransition(
  from: ExperimentStatus,
  to: ExperimentStatus
) {
  if (!canTransitionExperimentStatus(from, to)) {
    throw new Error(
      `Experiment status cannot transition from "${from}" to "${to}".`
    );
  }

  return to;
}
