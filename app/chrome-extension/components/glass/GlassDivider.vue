<script setup lang="ts">
defineProps<{
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}>();
</script>

<template>
  <div
    :class="[
      'glass-divider',
      orientation === 'vertical' ? 'glass-divider--vertical' : 'glass-divider--horizontal',
      label && 'glass-divider--labeled',
    ]"
  >
    <span v-if="label" class="glass-divider__label">{{ label }}</span>
  </div>
</template>

<style scoped>
.glass-divider--horizontal {
  width: 100%;
  height: 1px;
  background: var(--glass-border-subtle);
}

.glass-divider--vertical {
  width: 1px;
  height: 100%;
  background: var(--glass-border-subtle);
}

.glass-divider--labeled {
  display: flex;
  align-items: center;
  gap: 12px;
  height: auto;
  background: none;
}

.glass-divider--labeled::before,
.glass-divider--labeled::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--glass-border-subtle);
}

.glass-divider__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--ac-text-subtle, #a0aec0);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
</style>
