<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  removable?: boolean;
}>();

defineEmits<{ remove: [] }>();
</script>

<template>
  <span
    :class="[
      'glass-chip glass-transition',
      `glass-chip--${variant || 'default'}`,
      `glass-chip--${size || 'sm'}`,
    ]"
  >
    <span v-if="$slots.icon" class="glass-chip__icon">
      <slot name="icon" />
    </span>
    <slot />
    <button v-if="removable" class="glass-chip__remove" @click.stop="$emit('remove')">
      &times;
    </button>
  </span>
</template>

<style scoped>
.glass-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  border-radius: 100px;
  backdrop-filter: blur(var(--glass-blur-subtle));
  -webkit-backdrop-filter: blur(var(--glass-blur-subtle));
}

.glass-chip--sm {
  padding: 2px 8px;
  font-size: 11px;
}
.glass-chip--md {
  padding: 3px 10px;
  font-size: 12px;
}

.glass-chip--default {
  background: var(--glass-surface);
  color: var(--ac-text-muted, #4a5568);
  border: 1px solid var(--glass-border-subtle);
}

.glass-chip--accent {
  background: rgba(124, 58, 237, 0.12);
  color: var(--ac-accent, #7c3aed);
  border: 1px solid rgba(124, 58, 237, 0.18);
}

.glass-chip--success {
  background: rgba(34, 197, 94, 0.12);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.18);
}

.glass-chip--warning {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.18);
}

.glass-chip--danger {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.18);
}

.glass-chip__icon {
  display: flex;
  align-items: center;
}

.glass-chip__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 12px;
  line-height: 1;
  color: currentColor;
  opacity: 0.5;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.glass-chip__remove:hover {
  opacity: 1;
}
</style>
