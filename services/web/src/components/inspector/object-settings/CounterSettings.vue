<template>
      <!-- Counter settings -->
      <Section label="Counter">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-20">Start value</span>
            <input type="number" step="1" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.value ?? 0" @change="store.setCounterValue(obj.id, $event.target.value)" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" data-test="counter-integer" :checked="obj.useInteger" @change="store.setCounterInteger(obj.id, $event.target.checked)" />
            <span class="text-[11px] text-studio-text-muted">Integer mode (whole numbers)</span>
          </label>
          <div class="flex items-center gap-2" v-if="!obj.useInteger">
            <span class="text-[10px] text-studio-text-muted w-20">Decimals</span>
            <input type="number" step="1" min="0" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.numDecimals ?? 0" @change="store.setCounterDecimals(obj.id, $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-20">Suffix</span>
            <input type="text" class="w-full px-2 py-1 text-[11px] rounded bg-studio-bg border border-studio-border text-studio-text"
                   :value="obj.suffix ?? ''" @input="store.setCounterSuffix(obj.id, $event.target.value)" placeholder="e.g. %" />
          </div>
        </div>
      </Section>
</template>

<script setup>
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;
</script>
