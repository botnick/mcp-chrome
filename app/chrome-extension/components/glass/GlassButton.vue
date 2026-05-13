<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}>();

defineEmits<{ click: [e: MouseEvent] }>();
</script>

<template>
  <button
    :disabled="disabled || loading"
    :class="[
      'glass-btn glass-transition glass-focus-ring',
      `glass-btn--${variant || 'default'}`,
      `glass-btn--${size || 'md'}`,
      loading && 'glass-btn--loading',
    ]"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="glass-btn__spinner" />
    <slot />
  </button>
</template>

<style scoped>
.glass-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 500;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius-sm);
  cursor: pointer;
  transition: all 180ms ease;
  backdrop-filter: blur(var(--glass-blur-subtle));
  -webkit-backdrop-filter: blur(var(--glass-blur-subtle));
}

.glass-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.glass-btn--sm {
  padding: 4px 10px;
  font-size: 12px;
}
.glass-btn--md {
  padding: 7px 16px;
  font-size: 13px;
}
.glass-btn--lg {
  padding: 10px 22px;
  font-size: 14px;
}

.glass-btn--default {
  background: var(--glass-surface);
  color: var(--ac-text, #2d3748);
}
.glass-btn--default:hover:not(:disabled) {
  background: var(--glass-surface-raised);
  transform: translateY(-0.5px);
}

.glass-btn--primary {
  background: var(--ac-accent, #7c3aed);
  color: #ffffff;
  border-color: transparent;
}
.glass-btn--primary:hover:not(:disabled) {
  background: var(--ac-accent-hover, #6d28d9);
  transform: translateY(-0.5px);
  box-shadow: 0 4px 16px -2px rgba(124, 58, 237, 0.3);
}

.glass-btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--ac-text, #2d3748);
}
.glass-btn--ghost:hover:not(:disabled) {
  background: var(--glass-surface-sunken);
}

.glass-btn--danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}
.glass-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.18);
}

.glass-btn--loading {
  pointer-events: none;
}

.glass-btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: glass-spin 600ms linear infinite;
}

@keyframes glass-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
