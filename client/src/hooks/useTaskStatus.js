import { useCallback, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { tasksApi } from '../services/resources.js';

/**
 * Shared status-change behaviour for every task list, so the control behaves the
 * same on the Tasks page, a project page and the employee dashboard.
 *
 * `busyId` lets a row disable just its own control while the request is in flight.
 */
export const useTaskStatus = (onChanged) => {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  const changeStatus = useCallback(
    async (task, status) => {
      if (!task || !status || status === task.status) return;

      setBusyId(task._id);
      try {
        const response = await tasksApi.setStatus(task._id, status);
        toast.success(response.message || 'Task status updated.');
        onChanged?.(response.data);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setBusyId(null);
      }
    },
    [onChanged, toast],
  );

  return { changeStatus, busyId };
};
