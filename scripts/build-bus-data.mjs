// Generates src/data/busLines.js and src/data/busStops.js from the
// "Autobusové linky VDKHK" export of the Hradec Králové Region open data
// portal (https://www.datakhk.cz/datasets/ebc0da36c2bd4fdb9505ddab8b789007_7/).
//
// Usage: node scripts/build-bus-data.mjs
//
// The export only lists each line's route as a dash-separated list of places
// (no stop coordinates), so stops are the places named in those routes.
// Rows without a route are skipped.

import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const csvPath = new URL('data-src/autobusove-linky-vdkhk.csv', root)

// The source abbreviates place names inconsistently ("Kostelec n.O.",
// "Kostelec n.Orl.", "Kostelec .Orl.", ...); expand them to full names so
// shared stops are deduplicated. Rules apply to each comma-separated part.
const WHOLE_NAMES = {
    'H.Králové': 'Hradec Králové',
    'Hr.Králové': 'Hradec Králové',
    'Kostelec .Orl.': 'Kostelec nad Orlicí',
    // MHD Náchod stops
    'aut.st.': 'Náchod, autobusové stanoviště',
    'St.Město': 'Náchod, Staré Město',
}

const PREFIXES = [
    [/^N\.\s*Město/, 'Nové Město'],
    [/^N\.\s*Hrádek/, 'Nový Hrádek'],
    [/^Č\.\s*Meziříčí/, 'České Meziříčí'],
    [/^Č\.\s*Skalice/, 'Česká Skalice'],
    [/^Č\.\s*Čermná/, 'Česká Čermná'],
    [/^Kost\.\s*Lhota/, 'Kostelecká Lhota'],
    [/^Král\.\s*Lhota/, 'Králova Lhota'],
    [/^Hor\.\s*Malá Úpa/, 'Horní Malá Úpa'],
    [/^sídl\.\s*/, 'Sídliště '],
]

const SUFFIXES = [
    [/ n\.\s*O(rl)?\.?$/, ' nad Orlicí'],
    [/ v (O|Orl)\.\s*h\.$| v Orlh\.$/, ' v Orlických horách'],
    [/ n\.\s*L(ab)?\.$/, ' nad Labem'],
    [/ n\.\s*M(et)?\.$/, ' nad Metují'],
    [/ n\.\s*Jiz\.$/, ' nad Jizerou'],
    [/ n\.\s*Nisou$/, ' nad Nisou'],
    [/ n\.\s*Cidl\.?$/, ' nad Cidlinou'],
    [/ n\.\s*K(n|něž)?\.$/, ' nad Kněžnou'],
    [/ n\.\s*Zd(ob)?\.$/, ' nad Zdobnicí'],
    [/ n\.\s*B(ělou|\.)$/, ' nad Bělou'],
    [/ n\.\s*Úpou$/, ' nad Úpou'],
    [/ n\.\s*Pop\.$/, ' nad Popelkou'],
    [/ n\.\s*Bystř\.$/, ' nad Bystřicí'],
    [/ p\.\s*Oreb\.$/, ' pod Orebem'],
    [/ p\.\s*Sněž(kou|\.)$/, ' pod Sněžkou'],
    [/ p\.\s*Tr\.$/, ' pod Troskami'],
    [/ p\.\s*Hořičkami$/, ' pod Hořičkami'],
    [/ v Krk\.$/, ' v Krkonoších'],
    [/ u St\.\s*Paky$/, ' u Staré Paky'],
]

function placeName(raw) {
    return raw.split(/\s*,\s*/).map(part => {
        if (WHOLE_NAMES[part]) return WHOLE_NAMES[part]
        for (const [re, full] of [...PREFIXES, ...SUFFIXES]) part = part.replace(re, full)
        return part
    }).join(', ')
}

const COLORS = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
    '#6366f1', '#14b8a6', '#f97316', '#a855f7', '#22c55e', '#eab308', '#0ea5e9',
]

function parseCsv(text) {
    const rows = []
    let row = []
    let field = ''
    let quoted = false
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
            else if (c === '"') quoted = false
            else field += c
        } else if (c === '"') quoted = true
        else if (c === ',') { row.push(field); field = '' }
        else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
        else field += c
    }
    if (field || row.length) { row.push(field); rows.push(row) }
    const [header, ...body] = rows
    return body.filter(r => r.length === header.length)
        .map(r => Object.fromEntries(header.map((h, i) => [h.replace(/^﻿/, ''), r[i]])))
}

function routePlaces(trasa) {
    // drop prefixes like "Turistický autobus s přepravou kol (baťoh): "
    // and suffixes like " a zpět (MHD Rychnov n. Kněž.)"
    const route = (trasa.includes(': ') ? trasa.slice(trasa.lastIndexOf(': ') + 2) : trasa)
        .replace(/\s+a zpět\s*\(.*\)$/, '')
    return route
        .split(/\s*[-–]\s*/)
        .flatMap(part => part.split(/\s*\/\s*/)) // "A / B" marks alternative branches
        .map(part => part.trim())
        .filter(Boolean)
        .map(placeName)
}

const records = parseCsv(readFileSync(csvPath, 'utf8'))
    .map(r => ({
        number: r.linka.replace(/^(IDOL|PID)\s*/, '').trim(),
        places: routePlaces(r.trasa),
        timetable: r.jizd_rad,
    }))
    .filter(r => r.places.length > 1)
    .sort((a, b) => Number(a.number) - Number(b.number))

const stops = []
const stopIds = new Map()
const stopId = (name) => {
    if (!stopIds.has(name)) {
        stopIds.set(name, stopIds.size + 1)
        stops.push({ id: stopIds.size, name })
    }
    return stopIds.get(name)
}

const lines = records.map((r, i) => ({
    id: i + 1,
    number: r.number,
    // circular lines end where they start, so name them after the furthest other place
    name: `${r.places[0]} - ${r.places.findLast(p => p !== r.places[0])}`,
    color: COLORS[i % COLORS.length],
    stops: [...new Set(r.places.map(stopId))],
    timetable: r.timetable,
}))

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const header = '// Generated by scripts/build-bus-data.mjs from data-src/autobusove-linky-vdkhk.csv. Do not edit by hand.\n'

writeFileSync(new URL('src/data/busLines.js', root), header + 'export const busLines = [\n' + lines.map(l =>
    `    { id: ${l.id}, number: ${q(l.number)}, name: ${q(l.name)}, color: ${q(l.color)}, stops: [${l.stops.join(', ')}], timetable: ${q(l.timetable)} },`
).join('\n') + '\n]\n')

writeFileSync(new URL('src/data/busStops.js', root), header + 'export const busStops = [\n' + stops.map(s =>
    `    { id: ${s.id}, name: ${q(s.name)} },`
).join('\n') + '\n]\n')

console.log(`Wrote ${lines.length} lines and ${stops.length} stops`)
