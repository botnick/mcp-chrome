<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  title?: string;
  width?: 'sm' | 'md' | 'lg';
}>();

defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <Teleport to="body">
    <Transition name="glass-modal">
      <div
        v-if="modelValue"
        class="glass-modal-backdrop"
        @click.self="$emit('update:modelValue', false)"
      >
        <div
          :class="[
            'glass-modal-content glass-raised glass-appear',
            width === 'sm' ? 'max-w-xs' : width === 'lg' ? 'max-w-lg' : 'max-w-sm',
          ]"
        >
          <div v-if="title" class="glass-modal-header">
            <h3>{{ title }}</h3>
            <button class="glass-modal-close" @click="$emit('update:modelValue', false)">
              &times;
            </button>
          </div>
          <div class="glass-modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="glass-modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.glass-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.glass-modal-content {
  width: 100%;
  overflow: hidden;
}

.glass-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--glass-border-subtle);
}

.glass-modal-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--ac-text, #2d3748);
  margin: 0;
}

.glass-modal-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--ac-text-muted, #718096);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 150ms ease;
}

.glass-modal-close:hover {
  background: var(--glass-surface-sunken);
}

.glass-modal-body {
  padding: 14px 16px;
}

.glass-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid var(--glass-border-subtle);
}

.glass-modal-enter-active,
.glass-modal-leave-active {
  transition: opacity 180ms ease;
}

.glass-modal-enter-active .glass-modal-content,
.glass-modal-leave-active .glass-modal-content {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.glass-modal-enter-from,
.glass-modal-leave-to {
  opacity: 0;
}

.glass-modal-enter-from .glass-modal-content {
  transform: scale(0.96);
  opacity: 0;
}

.glass-modal-leave-to .glass-modal-content {
  transform: scale(0.96);
  opacity: 0;
}
</style>
