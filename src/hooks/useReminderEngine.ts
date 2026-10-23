import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

/**
 * Plays a pleasant synthetic two-tone chime via Web Audio API without external audio assets.
 */
export function playReminderChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.18, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('Web Audio chime not permitted or supported:', e);
  }
}

/**
 * Safely requests Notification permission if in 'default' state.
 */
export function requestBrowserNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(err => {
        console.warn('Notification permission request error:', err);
      });
    }
  }
}

/**
 * Time-based reminder engine that checks active tasks every 25 seconds.
 * Fires native browser notifications, in-app toast, audio chime, and prevents repeat notifications.
 */
export function useReminderEngine() {
  const { tasks, markReminderNotified, openTaskModal, addToast } = useWorkspaceStore();
  const checkingRef = useRef(false);

  useEffect(() => {
    requestBrowserNotificationPermission();
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const now = new Date();
        const activeTasks = tasks.filter(
          t => t.stageId !== 'COMPLETED' && Boolean(t.reminderAt) && !t.reminderNotified
        );

        for (const task of activeTasks) {
          if (!task.reminderAt) continue;
          const reminderDate = new Date(task.reminderAt);

          if (!isNaN(reminderDate.getTime()) && reminderDate <= now) {
            // 1. Browser Native Notification
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                new Notification(`⏰ Pengingat Task: ${task.title}`, {
                  body: `Deadline: ${task.deadline} · PIC: ${task.picHq}\n${
                    task.notes || 'Waktunya cek task ini!'
                  }`,
                  icon: '/favicon.svg'
                });
              } catch (notifErr) {
                console.warn('Failed to fire browser notification:', notifErr);
              }
            }

            // 2. In-app toast with 'Lihat Task' action
            addToast(
              `⏰ Pengingat: "${task.title}" sudah waktunya! (PIC: ${task.picHq})`,
              'info',
              {
                label: 'Lihat Task',
                onClick: () => openTaskModal(task.id)
              },
              10000
            );

            // 3. Play chime sound
            playReminderChime();

            // 4. Mark task as notified
            markReminderNotified(task.id);
          }
        }
      } catch (err) {
        console.error('Error during reminder check interval:', err);
      } finally {
        checkingRef.current = false;
      }
    };

    checkReminders();
    const intervalId = setInterval(checkReminders, 25000);

    return () => clearInterval(intervalId);
  }, [tasks, markReminderNotified, openTaskModal, addToast]);
}
