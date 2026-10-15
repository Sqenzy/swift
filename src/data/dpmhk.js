// Bus lines and stops of Hradec Králové city transport (DPmHK), built from the
// line list in dpmhk-lines.json when the app loads.
//
// The source lists each line's routes with only their start and end stop
// (plus a stop count), so a line's stops are the ends of its routes.

import source from './dpmhk-lines.json'

// Not passenger lines: depot transfers, ticket pre-sale and test lines
const EXCLUDED_LINES = new Set(['Přejezd', '999999', '908', '999'])
const DEPOT = '# vozovny #'

const cleanStop = (name) => name.replace(/\s+/g, ' ').trim()
const isStop = (name) => name !== '' && name !== DEPOT

// Numbered lines first in numeric order (5, 5Š, 10, 10Š, ...), then lettered ones (D, M, N1, ...)
function compareNumbers(a, b) {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1
    if (!isNaN(na) && na !== nb) return na - nb
    return a.localeCompare(b, 'cs')
}

// The source's line names are mostly internal ("Terminál - nástup - Terminál", where
// "nástup" is the pull-out from the depot), so name a line after its longest route
// between two different stops. Event lines without one keep their own name
// ("Noc vědy"); loop-only lines are named after their stop.
function lineEnds(line, routes) {
    const candidates = routes.filter(r => isStop(r.from) && isStop(r.to) && r.from !== r.to)
    if (candidates.length > 0) {
        const longest = candidates.reduce((best, r) => (r.stopCount > best.stopCount ? r : best))
        return { from: longest.from, to: longest.to }
    }
    const loop = routes.find(r => isStop(r.from))
    if (/nástup/.test(line.name) && loop) return { from: loop.from, to: '' }
    return { from: line.name.trim(), to: '' }
}

export const busStops = []
const stopIds = new Map()
const stopId = (name) => {
    if (!stopIds.has(name)) {
        stopIds.set(name, stopIds.size + 1)
        busStops.push({ id: stopIds.size, name })
    }
    return stopIds.get(name)
}

export const busLines = source.lines
    .filter(line => !EXCLUDED_LINES.has(line.lineNumber))
    .sort((a, b) => compareNumbers(a.lineNumber, b.lineNumber))
    .map((line, i) => {
        const routes = line.routes.map(r => ({
            from: cleanStop(r.startName),
            to: cleanStop(r.endName),
            direction: r.direction,
            stopCount: r.stopCount,
        }))
        const ends = routes.flatMap(r => [r.from, r.to]).filter(isStop)
        const { from, to } = lineEnds(line, routes)
        return {
            id: i + 1,
            number: String(i + 1),
            name: to ? `${from} - ${to}` : from,
            from,
            to,
            stops: [...new Set(ends.map(stopId))],
            routes,
        }
    })
