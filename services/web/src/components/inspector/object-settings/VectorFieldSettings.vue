<template>
      <!-- Vector Field settings -->
      <Section label="Vector Field">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-8">fx</span>
            <input class="input input-sm flex-1" :value="obj.fx" @change="store.setFieldExpr(obj.id, 'fx', $event.target.value)" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-studio-text-muted w-8">fy</span>
            <input class="input input-sm flex-1" :value="obj.fy" @change="store.setFieldExpr(obj.id, 'fy', $event.target.value)" />
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <Num label="x min" :value="(obj.xRange || [-3,3,1])[0]" @input="store.setFieldRange(obj.id, 'xRange', [$event, (obj.xRange||[-3,3,1])[1], (obj.xRange||[-3,3,1])[2]])" />
            <Num label="x max" :value="(obj.xRange || [-3,3,1])[1]" @input="store.setFieldRange(obj.id, 'xRange', [(obj.xRange||[-3,3,1])[0], $event, (obj.xRange||[-3,3,1])[2]])" />
            <Num label="x step" :value="(obj.xRange || [-3,3,1])[2]" @input="store.setFieldRange(obj.id, 'xRange', [(obj.xRange||[-3,3,1])[0], (obj.xRange||[-3,3,1])[1], $event])" />
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <Num label="y min" :value="(obj.yRange || [-2,2,1])[0]" @input="store.setFieldRange(obj.id, 'yRange', [$event, (obj.yRange||[-2,2,1])[1], (obj.yRange||[-2,2,1])[2]])" />
            <Num label="y max" :value="(obj.yRange || [-2,2,1])[1]" @input="store.setFieldRange(obj.id, 'yRange', [(obj.yRange||[-2,2,1])[0], $event, (obj.yRange||[-2,2,1])[2]])" />
            <Num label="y step" :value="(obj.yRange || [-2,2,1])[2]" @input="store.setFieldRange(obj.id, 'yRange', [(obj.yRange||[-2,2,1])[0], (obj.yRange||[-2,2,1])[1], $event])" />
          </div>
        </div>
      </Section>
</template>

<script setup>
import { useProjectStore } from '../../../store/project.js';
import Section from '../ui/Section.vue';
import Num from '../ui/Num.vue';
const props = defineProps({ obj: { type: Object, required: true } });
const store = useProjectStore();
const obj = props.obj;
</script>
