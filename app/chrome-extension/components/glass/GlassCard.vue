<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'raised' | 'sunken';
  hover?: boolean;
  edge?: boolean;
  rounded?: 'sm' | 'md' | 'lg' | 'xl';
}>();
</script>

<template>
  <div
    :class="[
      variant === 'raised' ? 'glass-raised' : variant === 'sunken' ? 'glass-sunken' : 'glass',
      hover && 'glass-hover cursor-pointer',
      edge && 'glass-edge',
      rounded === 'sm'
        ? 'rounded-lg'
        : rounded === 'xl'
          ? 'rounded-2xl'
          : rounded === 'lg'
            ? 'rounded-xl'
            : 'rounded-xl',
    ]"
    class="glass-transition"
  >
    <slot />
  </div>
</template>
