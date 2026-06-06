<template>
      <!-- Parametric settings -->
      <Section label="Parametric">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-8">x(t)</span>
            <input class="input input-sm flex-1" :value="obj.xExpr" @change="u('xExpr', $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-8">y(t)</span>
            <input class="input input-sm flex-1" :value="obj.yExpr" @change="u('yExpr', $event.target.value)" />
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <Num label="t min" :value="obj.tMin ?? 0" @input="u('tMin', $event)" />
            <Num label="t max" :value="obj.tMax ?? 6.283" @input="u('tMax', $event)" />
          </div>
        </div>
      </Section>
</template>

<script setup>
import { useObjectUpdate } from '../useObjectUpdate.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const { u } = useObjectUpdate(() => props.obj);
const obj = props.obj;
</script>
