import {useState, useEffect} from 'react'
import './Home.css'
import BusMap from "./Map.jsx"
import { busLines, busStops } from './data/dpmhk.js'

// Line colour palette; lines cycle through it in order. `text` is the colour of
// the line number on top of it (dark on the light colours so it stays readable).
const LINE_COLORS = [
    { color: '#ff595e', text: '#ffffff' }, // vibrant coral
    { color: '#ffca3a', text: '#1f1f1f' }, // golden pollen
    { color: '#8ac926', text: '#1f1f1f' }, // yellow green
    { color: '#1982c4', text: '#ffffff' }, // steel blue
    { color: '#6a4c93', text: '#ffffff' }, // dusty grape
]

const lineColorStyle = (line) => {
    const { color, text } = LINE_COLORS[(line.id - 1) % LINE_COLORS.length]
    return { '--line-color': color, '--line-text-color': text }
}

// Travel log: the rider logs the rides they take and earns XP, levels, a daily
// streak and badges. Progress is kept in localStorage.
const PROGRESS_KEY = 'linky-progress'

const XP = { ride: 10, newLine: 25, newStop: 5, challenge: 50, streak: 10 }

const LEVEL_TITLES = ['Nováček', 'Cestující', 'Pravidelný cestující', 'Objevitel', 'Průzkumník', 'Znalec MHD', 'Mistr jízdních řádů', 'Legenda DPmHK']

// Level n starts at 25·(n-1)² XP: 0, 25, 100, 225, 400, ...
const levelInfo = (xp) => {
    const level = Math.floor(Math.sqrt(xp / 25)) + 1
    const start = 25 * (level - 1) ** 2
    const next = 25 * level ** 2
    return {
        level,
        title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
        current: xp - start,
        needed: next - start,
    }
}

const BADGES = [
    { id: 'first', icon: '🎫', name: 'První jízda', desc: 'Zapište svou první jízdu', test: s => s.rides >= 1 },
    { id: 'lines5', icon: '🚌', name: 'Pět linek', desc: 'Projeďte 5 různých linek', test: s => s.lineCount >= 5 },
    { id: 'stops25', icon: '📍', name: 'Sběratel zastávek', desc: 'Objevte 25 zastávek', test: s => s.stopCount >= 25 },
    { id: 'streak3', icon: '🔥', name: 'Na vlně', desc: 'Jezděte 3 dny po sobě', test: s => s.bestStreak >= 3 },
    { id: 'challenge3', icon: '🎯', name: 'Lovec výzev', desc: 'Splňte 3 výzvy dne', test: s => s.challenges >= 3 },
    { id: 'lines20', icon: '🗺️', name: 'Znalec sítě', desc: 'Projeďte 20 různých linek', test: s => s.lineCount >= 20 },
    { id: 'streak7', icon: '⚡', name: 'Týden v pohybu', desc: 'Jezděte 7 dní po sobě', test: s => s.bestStreak >= 7 },
    { id: 'half', icon: '🏙️', name: 'Půlka města', desc: 'Projeďte polovinu všech linek', test: s => s.lineCount >= Math.ceil(busLines.length / 2) },
    { id: 'all', icon: '👑', name: 'Celá síť', desc: 'Projeďte všechny linky', test: s => s.lineCount >= busLines.length },
]

const EMPTY_PROGRESS = {
    xp: 0,
    rides: 0,
    lines: {},      // lineId -> number of rides
    lineDays: {},   // lineId -> day of the last logged ride
    stops: [],      // ids of discovered stops
    streak: 0,
    bestStreak: 0,
    lastDay: null,
    challenges: 0,
    challenge: null, // { day, lineId, done }
}

const dayKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const previousDay = (day) => {
    const date = new Date(`${day}T12:00:00`)
    date.setDate(date.getDate() - 1)
    return dayKey(date)
}

// The streak still counts if the last ride was today or yesterday
const currentStreak = (progress, today) =>
    progress.lastDay === today || progress.lastDay === previousDay(today) ? progress.streak : 0

// One challenge line per day, preferring lines the rider hasn't taken yet
const withChallenge = (progress, today) => {
    if (progress.challenge?.day === today || busLines.length === 0) return progress
    const unridden = busLines.filter(line => !progress.lines[line.id])
    const pool = unridden.length > 0 ? unridden : busLines
    const hash = [...today].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
    return { ...progress, challenge: { day: today, lineId: pool[hash % pool.length].id, done: false } }
}

const progressStats = (progress) => ({
    rides: progress.rides,
    lineCount: Object.keys(progress.lines).length,
    stopCount: progress.stops.length,
    bestStreak: progress.bestStreak,
    challenges: progress.challenges,
})

const loadProgress = (today) => {
    let saved
    try {
        saved = JSON.parse(localStorage.getItem(PROGRESS_KEY))
    } catch {
        saved = null
    }
    return withChallenge({ ...EMPTY_PROGRESS, ...saved }, today)
}

const daysLabel = (n) => (n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní')

export default function Home() {

    const [showJournal, setShowJournal] = useState(false)
    const [today, setToday] = useState(() => dayKey(new Date()))
    const [progress, setProgress] = useState(() => loadProgress(today))
    const [gain, setGain] = useState(null)

    const [selectedLine, setSelectedLine] = useState(null)
    const [favorites, setFavorites] = useState([])
    const [searchFrom, setSearchFrom] = useState('')
    const [searchTo, setSearchTo] = useState('')
    const [showFromResults, setShowFromResults] = useState(false)
    const [showToResults, setShowToResults] = useState(false)
    const [lineFilter, setLineFilter] = useState('all')

    const normalizeText = (text) => {
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    }

    const filteredFromStops = busStops.filter(stop =>
        normalizeText(stop.name).includes(normalizeText(searchFrom))
    )

    const filteredToStops = busStops.filter(stop =>
        normalizeText(stop.name).includes(normalizeText(searchTo))
    )

    const filteredFromLines = busLines.filter(line =>
        (normalizeText(`${line.number} ${line.name}`).includes(normalizeText(searchFrom)) ||
            line.stops.some(stopId => {
                const stop = busStops.find(s => s.id === stopId)
                return stop && normalizeText(stop.name).includes(normalizeText(searchFrom))
            }))
    )

    const filteredToLines = busLines.filter(line =>
        (normalizeText(`${line.number} ${line.name}`).includes(normalizeText(searchTo)) ||
            line.stops.some(stopId => {
                const stop = busStops.find(s => s.id === stopId)
                return stop && normalizeText(stop.name).includes(normalizeText(searchTo))
            }))
    )

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('theme')
        if (saved) return saved
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('theme', theme)
    }, [theme])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.search-container')) {
                setShowFromResults(false)
                setShowToResults(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
        } catch {
            // Progress just isn't kept when storage is unavailable
        }
    }, [progress])

    useEffect(() => {
        if (!gain) return
        const timer = setTimeout(() => setGain(null), 3500)
        return () => clearTimeout(timer)
    }, [gain])

    const logRide = (line) => {
        const day = dayKey(new Date())
        const before = withChallenge(progress, day)
        if (before.lineDays[line.id] === day) return

        const notes = [`Jízda +${XP.ride}`]
        let xp = XP.ride

        const isNewLine = !before.lines[line.id]
        if (isNewLine) {
            xp += XP.newLine
            notes.push(`Nová linka +${XP.newLine}`)
        }

        const newStops = line.stops.filter(id => !before.stops.includes(id))
        if (newStops.length > 0) {
            xp += newStops.length * XP.newStop
            notes.push(`${newStops.length}× nová zastávka +${newStops.length * XP.newStop}`)
        }

        let { streak, challenges, challenge } = before
        if (before.lastDay !== day) {
            streak = before.lastDay === previousDay(day) ? before.streak + 1 : 1
            if (streak > 1) {
                xp += XP.streak
                notes.push(`Série ${streak} ${daysLabel(streak)} +${XP.streak}`)
            }
        }

        if (challenge && challenge.lineId === line.id && !challenge.done) {
            xp += XP.challenge
            challenges += 1
            challenge = { ...challenge, done: true }
            notes.push(`Výzva dne +${XP.challenge}`)
        }

        const after = {
            ...before,
            xp: before.xp + xp,
            rides: before.rides + 1,
            lines: { ...before.lines, [line.id]: (before.lines[line.id] || 0) + 1 },
            lineDays: { ...before.lineDays, [line.id]: day },
            stops: [...before.stops, ...newStops],
            streak,
            bestStreak: Math.max(before.bestStreak, streak),
            lastDay: day,
            challenges,
            challenge,
        }

        const statsBefore = progressStats(before)
        const statsAfter = progressStats(after)
        const badges = BADGES.filter(b => !b.test(statsBefore) && b.test(statsAfter))
        const levelUp = levelInfo(after.xp).level > levelInfo(before.xp).level

        setToday(day)
        setProgress(after)
        setGain({ xp, notes, badges, level: levelUp ? levelInfo(after.xp) : null })
    }

    const toggleFavorite = (lineId) => {
        setFavorites(prev =>
            prev.includes(lineId)
                ? prev.filter(id => id !== lineId)
                : [...prev, lineId]
        )
    }

    const sortedBusLines = [...busLines].sort((a, b) => {
        const aFav = favorites.includes(a.id)
        const bFav = favorites.includes(b.id)
        if (aFav && !bFav) return -1
        if (!aFav && bFav) return 1
        return a.id - b.id
    })

    const visibleLines = lineFilter === 'favorites'
        ? sortedBusLines.filter(line => favorites.includes(line.id))
        : sortedBusLines

    const level = levelInfo(progress.xp)
    const streak = currentStreak(progress, today)
    const ridden = (lineId) => Boolean(progress.lines[lineId])
    const riddenLineCount = Object.keys(progress.lines).length

    const swapSearch = () => {
        setSearchFrom(searchTo)
        setSearchTo(searchFrom)
        setShowFromResults(false)
        setShowToResults(false)
    }

    return (
        <>
            <section className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <p className="name">Linky</p>
                    </div>
                    <button className="changemode"
                            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
                            aria-label="Toggle dark/light mode">
                        <img src="mode.png" alt=""/>
                    </button>
                </div>

                <div className="search-section">
                    <div className="route-track" aria-hidden="true">
                        <span className="route-point start"></span>
                        <span className="route-rail"></span>
                        <span className="route-point end"></span>
                    </div>
                    <div className="search-fields">
                        <StopSearch
                            placeholder="Odkud"
                            value={searchFrom}
                            onChange={setSearchFrom}
                            open={showFromResults}
                            setOpen={setShowFromResults}
                            stops={filteredFromStops}
                            lines={filteredFromLines}
                            onPickLine={setSelectedLine}
                        />
                        <StopSearch
                            placeholder="Kam"
                            value={searchTo}
                            onChange={setSearchTo}
                            open={showToResults}
                            setOpen={setShowToResults}
                            stops={filteredToStops}
                            lines={filteredToLines}
                            onPickLine={setSelectedLine}
                        />
                    </div>
                    <button className="swap-btn" onClick={swapSearch} aria-label="Prohodit Odkud a Kam" title="Prohodit">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>
                        </svg>
                    </button>
                </div>

                <div className="line-tabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={lineFilter === 'all'}
                        className={`line-tab ${lineFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setLineFilter('all')}
                    >
                        Vše <span className="tab-count"></span>
                    </button>
                    <button
                        role="tab"
                        aria-selected={lineFilter === 'favorites'}
                        className={`line-tab ${lineFilter === 'favorites' ? 'active' : ''}`}
                        onClick={() => setLineFilter('favorites')}
                    >
                        Oblíbené <span className="tab-count"></span>
                    </button>
                </div>

                <div className="content">
                    {visibleLines.length === 0 ? (
                        <div className="lines-empty">
                            <span className="lines-empty-icon">☆</span>
                            <p>Zatím žádné oblíbené linky.</p>
                            <p className="lines-empty-hint">Přidejte linku hvězdičkou v seznamu.</p>
                        </div>
                    ) : (
                        <ul className="lines">
                            {visibleLines.map(line => {
                                const origin = line.from
                                const destination = line.to
                                const isFavorite = favorites.includes(line.id)
                                return (
                                    <li
                                        key={line.id}
                                        className={`line ${selectedLine === line.id ? 'active' : ''}`}
                                        style={lineColorStyle(line)}
                                    >
                                        <button className="line-select" onClick={() => setSelectedLine(line.id)}>
                                            <span className="line-badge">{line.number}</span>
                                            <span className="line-text">
                                                <span className="line-origin">{origin}</span>
                                                {destination && <span className="line-destination">{destination}</span>}
                                            </span>
                                            {ridden(line.id) && (
                                                <span className="line-ridden" title="Projeto" aria-label="Projeto">✓</span>
                                            )}
                                        </button>
                                        <button
                                            className={`favorite-btn ${isFavorite ? 'favorited' : ''}`}
                                            onClick={() => toggleFavorite(line.id)}
                                            aria-label={isFavorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                                            aria-pressed={isFavorite}
                                        >
                                            {isFavorite ? '★' : '☆'}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <div className="colection">
                    {showJournal && (
                        <Journal
                            progress={progress}
                            level={level}
                            streak={streak}
                            today={today}
                            gain={gain}
                            selectedLine={busLines.find(line => line.id === selectedLine)}
                            onSelectLine={setSelectedLine}
                            onLogRide={logRide}
                            onClose={() => setShowJournal(false)}
                        />
                    )}
                    {gain && !showJournal && (
                        <span className="xp-toast" key={progress.rides}>+{gain.xp} XP</span>
                    )}
                    <button
                        className={`banner ${showJournal ? 'open' : ''}`}
                        onClick={() => setShowJournal(!showJournal)}
                        aria-expanded={showJournal}
                    >
                        <span className="logo-box level-box" aria-label={`Úroveň ${level.level}`}>
                            <span className="level-box-label">LVL</span>
                            {level.level}
                        </span>
                        <span className="info">
                            <span className="info-title">{level.title}</span>
                            <span className="info-sub">
                                {streak > 0 ? `🔥 ${streak} ${daysLabel(streak)} · ` : ''}
                                {riddenLineCount} / {busLines.length} linek
                                {progress.challenge && !progress.challenge.done ? ' · 🎯 výzva čeká' : ''}
                            </span>
                            <span className="collection-progress">
                                <span style={{ width: `${(level.current / level.needed) * 100}%` }}></span>
                            </span>
                        </span>
                        <span className="banner-chevron" aria-hidden="true">›</span>
                    </button>
                </div>
            </section>

            <section className="map">
                <BusMap/>
            </section>
        </>
        )
}

function Journal({ progress, level, streak, today, gain, selectedLine, onSelectLine, onLogRide, onClose }) {
    const stats = progressStats(progress)
    const unlocked = BADGES.filter(badge => badge.test(stats))
    const challengeLine = progress.challenge?.day === today
        ? busLines.find(line => line.id === progress.challenge.lineId)
        : null
    const challengeDone = challengeLine && progress.challenge.done
    const loggedToday = selectedLine && progress.lineDays[selectedLine.id] === today

    return (
        <div className="collection-menu journal">
            <div className="collection-menu-header">
                <h4>Cestovní deník</h4>
                <button className="close-menu" onClick={onClose} aria-label="Zavřít">✕</button>
            </div>
            <div className="collection-menu-content journal-content">
                <div className="journal-level">
                    <span className="logo-box level-box">
                        <span className="level-box-label">LVL</span>
                        {level.level}
                    </span>
                    <div className="journal-level-info">
                        <span className="info-title">{level.title}</span>
                        <span className="collection-progress">
                            <span style={{ width: `${(level.current / level.needed) * 100}%` }}></span>
                        </span>
                        <span className="info-sub">{level.current} / {level.needed} XP do další úrovně</span>
                    </div>
                </div>

                <div className="journal-stats">
                    <div className="journal-stat">
                        <strong>{stats.lineCount}<small>/{busLines.length}</small></strong>
                        <span>linek</span>
                    </div>
                    <div className="journal-stat">
                        <strong>{stats.stopCount}<small>/{busStops.length}</small></strong>
                        <span>zastávek</span>
                    </div>
                    <div className={`journal-stat ${streak > 0 ? 'hot' : ''}`}>
                        <strong>🔥 {streak}</strong>
                        <span>{daysLabel(streak)} v řadě</span>
                    </div>
                </div>

                {challengeLine && (
                    <div className={`journal-card challenge ${challengeDone ? 'done' : ''}`}>
                        <div className="journal-card-title">
                            🎯 Výzva dne
                            <span className="xp-pill">{challengeDone ? 'Splněno ✓' : `+${XP.challenge} XP`}</span>
                        </div>
                        <button
                            className="challenge-line"
                            style={lineColorStyle(challengeLine)}
                            onClick={() => onSelectLine(challengeLine.id)}
                            title="Ukázat linku"
                        >
                            <span className="result-line-number">{challengeLine.number}</span>
                            <span className="result-line-name">{challengeLine.name}</span>
                        </button>
                        {!challengeDone && <p className="journal-hint">Projeďte tuto linku ještě dnes a zapište jízdu.</p>}
                    </div>
                )}

                <div className="journal-card">
                    <div className="journal-card-title">🚏 Zapsat jízdu</div>
                    <select
                        className="ride-select"
                        value={selectedLine?.id ?? ''}
                        onChange={(e) => onSelectLine(e.target.value ? Number(e.target.value) : null)}
                        style={selectedLine ? lineColorStyle(selectedLine) : undefined}
                        aria-label="Linka"
                    >
                        <option value="">Vyberte linku…</option>
                        {busLines.map(line => (
                            <option key={line.id} value={line.id}>
                                {line.number} · {line.name}{progress.lines[line.id] ? ' ✓' : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        className="log-ride-btn"
                        onClick={() => onLogRide(selectedLine)}
                        disabled={!selectedLine || loggedToday}
                    >
                        {loggedToday ? 'Dnes už zapsáno ✓' : 'Jel(a) jsem touto linkou'}
                    </button>
                    {gain && (
                        <div className="journal-gain" key={progress.rides}>
                            <strong>+{gain.xp} XP</strong>
                            <span>{gain.notes.join(' · ')}</span>
                            {gain.level && <span className="journal-gain-extra">⬆️ Úroveň {gain.level.level}: {gain.level.title}</span>}
                            {gain.badges.map(badge => (
                                <span key={badge.id} className="journal-gain-extra">{badge.icon} Nový odznak: {badge.name}</span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="journal-card">
                    <div className="journal-card-title">
                        🏅 Odznaky
                        <span className="journal-count">{unlocked.length} / {BADGES.length}</span>
                    </div>
                    <div className="badge-grid">
                        {BADGES.map(badge => {
                            const has = unlocked.includes(badge)
                            return (
                                <div
                                    key={badge.id}
                                    className={`badge ${has ? 'unlocked' : 'locked'}`}
                                    title={badge.desc}
                                >
                                    <span className="badge-icon">{has ? badge.icon : '🔒'}</span>
                                    <span className="badge-name">{badge.name}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

function StopSearch({ placeholder, value, onChange, open, setOpen, stops, lines, onPickLine }) {
    const pick = (text) => {
        onChange(text)
        setOpen(false)
    }

    return (
        <div className="search-container">
            <div className="search-field">
                <input
                    type="text"
                    className="search-input"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value)
                        setOpen(true)
                    }}
                    onFocus={() => setOpen(true)}
                />
                {value && (
                    <button className="search-clear" onClick={() => onChange('')} aria-label="Vymazat">✕</button>
                )}
            </div>
            {open && value && (stops.length > 0 || lines.length > 0) && (
                <div className="search-results">
                    {stops.length > 0 && (
                        <div className="search-result-section">
                            <div className="search-result-section-title">Zastávky</div>
                            {stops.map(stop => (
                                <div
                                    key={stop.id}
                                    className="search-result-item"
                                    onClick={() => pick(stop.name)}
                                >
                                    {stop.name}
                                </div>
                            ))}
                        </div>
                    )}
                    {lines.length > 0 && (
                        <div className="search-result-section">
                            <div className="search-result-section-title">Linky</div>
                            {lines.map(line => (
                                <div
                                    key={line.id}
                                    className="search-result-item line-result"
                                    onClick={() => {
                                        pick(line.name)
                                        onPickLine(line.id)
                                    }}
                                    style={lineColorStyle(line)}
                                >
                                    <span className="result-line-number">{line.number}</span>
                                    <span className="result-line-name">{line.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
