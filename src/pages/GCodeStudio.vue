<template>
    <g-code-studio2-d></g-code-studio2-d>
</template>

<script lang="ts">
import GCodeStudio2D from '@/components/gcodestudio/GCodeStudio2D.vue'
import BaseMixin from '@/components/mixins/base'
import { Component, Mixins } from 'vue-property-decorator'

@Component({
    components: { GCodeStudio2D },
})
export default class PageGCodeStudio extends Mixins(BaseMixin) {
    /**
     * G-Code Studio page
     * Uses GCodeStudio2D which provides a Paper.js-based 2D viewer
     * with TurtleStitch-friendly rendering and studio controls
     */
}
</script>

<style lang="scss" scoped>
.gcode-studio-page {
    height: 100%;
    width: 100%;
}
</style>
