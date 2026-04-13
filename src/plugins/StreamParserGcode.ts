import { HighlightStyle, StringStream, syntaxHighlighting } from '@codemirror/language'
import { Tag, tags } from '@lezer/highlight'

const gcodeNumberPattern = '[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)?'
const gcodeNumericWord = (letters: string) => new RegExp(`^[${letters}](?:${gcodeNumberPattern})?`, 'i')

const gcodeTags = {
    lineNumber: Tag.define(tags.labelName),
    programNumber: Tag.define(tags.namespace),
    command: Tag.define(tags.keyword),
    axisX: Tag.define(tags.attributeName),
    axisY: Tag.define(tags.attributeName),
    axisZ: Tag.define(tags.attributeName),
    axisE: Tag.define(tags.attributeName),
    feed: Tag.define(tags.number),
    spindle: Tag.define(tags.atom),
    tool: Tag.define(tags.atom),
    parameter: Tag.define(tags.propertyName),
    variable: Tag.define(tags.variableName),
}

export const gcodeSyntaxHighlighting = syntaxHighlighting(
    HighlightStyle.define([
        { tag: gcodeTags.lineNumber, class: 'cm-gcode-line-word' },
        { tag: gcodeTags.programNumber, class: 'cm-gcode-program-word' },
        { tag: gcodeTags.command, class: 'cm-gcode-command-word' },
        { tag: gcodeTags.axisX, class: 'cm-gcode-axis-x' },
        { tag: gcodeTags.axisY, class: 'cm-gcode-axis-y' },
        { tag: gcodeTags.axisZ, class: 'cm-gcode-axis-z' },
        { tag: gcodeTags.axisE, class: 'cm-gcode-axis-e' },
        { tag: gcodeTags.feed, class: 'cm-gcode-feed-word' },
        { tag: gcodeTags.spindle, class: 'cm-gcode-spindle-word' },
        { tag: gcodeTags.tool, class: 'cm-gcode-tool-word' },
        { tag: gcodeTags.parameter, class: 'cm-gcode-parameter-word' },
        { tag: gcodeTags.variable, class: 'cm-gcode-variable-word' },
    ])
)

export const gcode = {
    token: function (stream: StringStream, state: StreamParserGcodeState, zeroPos = 0): string | null {
        if (stream.pos === zeroPos) {
            state.klipperMacro = false
            state.messageToEnd = false
        }

        if (stream.eatSpace()) return null

        const ch = stream.peek()
        const isCodeStart = stream.string.slice(zeroPos, stream.pos).trim().length === 0

        if (state.messageToEnd) {
            stream.skipToEnd()
            state.messageToEnd = false
            return 'string'
        }

        /* Klipper macro attributes */
        if (stream.pos > zeroPos && state.klipperMacro) {
            if (stream.match(/^{/)) {
                return 'brace'
            }
            if (stream.match(/^}/)) {
                return 'brace'
            }
            if (stream.match(/^#(?:<[^>\n]+>|\d+)/)) {
                return 'gcode-variable'
            }
            if (stream.match(/^"[^{]+"/) || stream.match(/^'[^{]+'/)) {
                return 'string'
            }
            if (stream.match(/^[-+]?[0-9]*\.?[0-9]+/)) {
                return 'number'
            }
            if (stream.match(/^[A-Za-z_][A-Za-z\d_]*/)) {
                return 'propertyName'
            } else if (zeroPos === 0 && stream.match(/^{[^%]+}/)) {
                return 'variable'
            }
        }

        /* comments */
        if (ch === ';') {
            stream.skipToEnd()
            return 'comment'
        }
        if (ch === '(') {
            stream.next()
            while (!stream.eol()) {
                if (stream.next() === ')') break
            }
            return 'comment'
        }

        if (stream.match(/^%+/)) return 'meta'

        if (stream.match(/^#(?:<[^>\n]+>|\d+)/)) return 'gcode-variable'

        if (stream.match(/^(?:\[|\])/)) return 'bracket'
        if (stream.match(/^[{}]/)) return 'brace'
        if (stream.match(/^[=+\-*/]/)) return 'operator'

        /* line and program numbers */
        if (stream.match(/^[Nn]\d+/)) return 'gcode-line-number'
        if (stream.match(/^[Oo]\d+/)) return 'gcode-program-number'

        /* message commands keep the payload as string */
        if (stream.match(/^_?[Mm](?:117|118)(?:\.\d+)?/)) {
            state.messageToEnd = true
            return 'gcode-command'
        }

        /* Mxxx Gxxx commands */
        if (stream.match(/^_?[GMgm][+-]?(?:\d+(?:\.\d+)?|\.\d+)/)) {
            return 'gcode-command'
        }

        /* machine coordinate words */
        if (stream.match(gcodeNumericWord('XAUI'))) return 'gcode-axis-x'
        if (stream.match(gcodeNumericWord('YBVJ'))) return 'gcode-axis-y'
        if (stream.match(gcodeNumericWord('ZCWK'))) return 'gcode-axis-z'
        if (stream.match(gcodeNumericWord('E'))) return 'gcode-axis-e'

        /* feed, spindle and tool words */
        if (stream.match(gcodeNumericWord('F'))) return 'gcode-feed'
        if (stream.match(gcodeNumericWord('S'))) return 'gcode-spindle'
        if (stream.match(gcodeNumericWord('T'))) return 'gcode-tool'

        /* common parameter words */
        if (stream.match(gcodeNumericWord('PQRHLD'))) return 'gcode-parameter'

        if (zeroPos === 0 && stream.pos > zeroPos && stream.match(/^{[^%]+}/)) return 'propertyName'

        /* Klipper macro names */
        if (isCodeStart && stream.match(/^[A-Z_\d]+/)) {
            state.klipperMacro = true
            return 'name'
        }

        stream.next()
        return null
    },
    startState: function (): StreamParserGcodeState {
        return {
            klipperMacro: false,
            messageToEnd: false,
        }
    },
    tokenTable: {
        'gcode-line-number': gcodeTags.lineNumber,
        'gcode-program-number': gcodeTags.programNumber,
        'gcode-command': gcodeTags.command,
        'gcode-axis-x': gcodeTags.axisX,
        'gcode-axis-y': gcodeTags.axisY,
        'gcode-axis-z': gcodeTags.axisZ,
        'gcode-axis-e': gcodeTags.axisE,
        'gcode-feed': gcodeTags.feed,
        'gcode-spindle': gcodeTags.spindle,
        'gcode-tool': gcodeTags.tool,
        'gcode-parameter': gcodeTags.parameter,
        'gcode-variable': gcodeTags.variable,
    },
    languageData: {
        commentTokens: { line: ';' },
    },
}

interface StreamParserGcodeState {
    klipperMacro: boolean
    messageToEnd: boolean
}
