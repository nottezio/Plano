import { setTodoTicks, updatePatient } from '@/data/repositories/patients.repo';
import { toggleTodo } from '@/domain/patientTodos';
import type { ClinicalDate, Patient } from '@/domain/types';

/** Tick or untick one Custom Checklist step on the day being viewed. */
export function tickTodo(patient: Patient, date: ClinicalDate, id: string): void {
  const change = toggleTodo(patient.todos ?? [], patient.todoTicks, date, id);
  if (change.todos) {
    void updatePatient(patient.id, { todos: change.todos }).catch((error: unknown) =>
      console.error('[todos] write rejected', error),
    );
  }
  if (change.ticks) {
    void setTodoTicks(patient.id, date, change.ticks).catch((error: unknown) =>
      console.error('[todos] tick write rejected', error),
    );
  }
}
