<script setup lang="ts">
defineProps<{
  modelValue?: string | number;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}>();

defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <textarea
    v-if="type === 'textarea'"
    class="glass-input glass-focus-ring"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows || 3"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
  <input
    v-else
    class="glass-input glass-focus-ring"
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style scoped>
.glass-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ac-text, #2d3748);
  background: var(--glass-surface-sunken);
  backdrop-filter: blur(var(--glass-blur-subtle));
  -webkit-backdrop-filter: blur(var(--glass-blur-subtle));
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--glass-radius-sm);
  box-shadow: var(--glass-shadow-inset);
  outline: none;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.glass-input::placeholder {
  color: var(--ac-text-subtle, #a0aec0);
}

.glass-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

textarea.glass-input {
  resize: vertical;
  min-height: 60px;
}
</style>
