import Vue from 'vue'
import Vuetify from 'vuetify'
import { Touch, Ripple } from 'vuetify/lib/directives'
import NeedleSvgIcon from '@/components/icons/NeedleSvgIcon.vue'

Vue.use(Vuetify, {
    directives: { Touch, Ripple },
})

export default new Vuetify({
    theme: {
        dark: true,
        options: { customProperties: true },
    },
    icons: {
        iconfont: 'mdiSvg',
        values: {
            needle: {
                component: NeedleSvgIcon,
            },
        },
    },
    breakpoint: {
        mobileBreakpoint: 768,
    },
})
