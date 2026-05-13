<template>
  <div v-if="visible" class="confirm-backdrop" @click.self="$emit('cancel')">
    <div class="confirm-dialog glass-raised glass-appear">
      <div class="confirm-header">
        <span class="confirm-icon">{{ icon }}</span>
        <h3 class="confirm-title">{{ title }}</h3>
      </div>

      <div class="confirm-body">
        <p class="confirm-message">{{ message }}</p>

        <ul v-if="items && items.length > 0" class="confirm-list glass-sunken">
          <li v-for="item in items" :key="item">{{ item }}</li>
        </ul>

        <div v-if="warning" class="confirm-warning glass-sunken">
          <strong>{{ warning }}</strong>
        </div>
      </div>

      <div class="confirm-actions">
        <button
          class="glass-btn glass-transition glass-focus-ring glass-btn--default"
          @click="$emit('cancel')"
        >
          {{ cancelText }}
        </button>
        <button
          class="glass-btn glass-transition glass-focus-ring glass-btn--danger"
          :disabled="isConfirming"
          @click="$emit('confirm')"
        >
          {{ isConfirming ? confirmingText : confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { getMessage } from '@/utils/i18n';
interface Props {
  visible: boolean;
  title: string;
  message: string;
  items?: string[];
  warning?: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  confirmingText?: string;
  isConfirming?: boolean;
}

interface Emits {
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}

withDefaults(defineProps<Props>(), {
  icon: '⚠️',
  confirmText: getMessage('confirmButton'),
  cancelText: getMessage('cancelButton'),
  confirmingText: getMessage('processingStatus'),
  isConfirming: false,
});

defineEmits<Emits>();
</script>

<style scoped>
/* Frosted glass backdrop */
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: confirm-fade-in 180ms ease-out;
}

@keyframes confirm-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Dialog panel — glass-raised & glass-appear handle surface + entrance */
.confirm-dialog {
  max-width: 360px;
  width: 100%;
  padding: 24px;
  overflow: hidden;
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.confirm-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.confirm-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--ac-text, #2d3748);
  margin: 0;
}

.confirm-body {
  margin-bottom: 24px;
}

.confirm-message {
  font-size: 14px;
  color: var(--ac-text-muted, #4a5568);
  margin: 0 0 16px 0;
  line-height: 1.6;
}

/* Items list — glass-sunken applied via class */
.confirm-list {
  margin: 16px 0;
  padding: 12px 12px 12px 32px;
  border-left: 3px solid var(--ac-accent, #7c3aed);
}

.confirm-list li {
  font-size: 13px;
  color: var(--ac-text-muted, #718096);
  margin-bottom: 6px;
  line-height: 1.4;
}

.confirm-list li:last-child {
  margin-bottom: 0;
}

/* Warning — glass-sunken with danger tint */
.confirm-warning {
  font-size: 13px;
  color: #ef4444;
  margin: 16px 0 0 0;
  padding: 12px;
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.2);
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* Glass button base */
.glass-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  min-width: 80px;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius-sm, 8px);
  cursor: pointer;
  backdrop-filter: blur(var(--glass-blur-subtle, 4px));
  -webkit-backdrop-filter: blur(var(--glass-blur-subtle, 4px));
}

.glass-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.glass-btn--default {
  background: var(--glass-surface, rgba(255, 255, 255, 0.7));
  color: var(--ac-text, #4a5568);
}

.glass-btn--default:hover {
  background: var(--glass-surface-raised, rgba(255, 255, 255, 0.85));
  transform: translateY(-0.5px);
}

.glass-btn--danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.glass-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.18);
  transform: translateY(-0.5px);
}

/* Responsive */
@media (max-width: 420px) {
  .confirm-dialog {
    padding: 20px;
    max-width: 320px;
  }

  .confirm-header {
    gap: 10px;
    margin-bottom: 16px;
  }

  .confirm-icon {
    font-size: 20px;
  }

  .confirm-title {
    font-size: 16px;
  }

  .confirm-message {
    font-size: 13px;
  }

  .confirm-list {
    padding: 10px 10px 10px 28px;
  }

  .confirm-list li {
    font-size: 12px;
  }

  .confirm-warning {
    font-size: 12px;
    padding: 10px;
  }

  .confirm-actions {
    gap: 8px;
    flex-direction: column-reverse;
  }

  .glass-btn {
    width: 100%;
    padding: 12px 16px;
  }
}
</style>
