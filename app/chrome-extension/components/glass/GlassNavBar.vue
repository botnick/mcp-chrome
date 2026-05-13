<script setup lang="ts">
defineProps<{
  sticky?: boolean;
}>();
</script>

<template>
  <header class="glass-nav glass-transition" :class="sticky && 'sticky top-0 z-40'">
    <div class="flex items-center gap-2 px-4 py-3">
      <div v-if="$slots.left" class="shrink-0">
        <slot name="left" />
      </div>
      <div class="flex-1 min-w-0">
        <slot />
      </div>
      <div v-if="$slots.right" class="shrink-0">
        <slot name="right" />
      </div>
    </div>
  </header>
</template>
