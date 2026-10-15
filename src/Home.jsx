import {useState, useEffect} from 'react'
import './Home.css'
import BusMap from "./Map.jsx"
import { busLines } from './data/busLines.js'
import { busStops } from './data/busStops.js'

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

export default function Home() {

    const [showCollectionMenu, setShowCollectionMenu] = useState(false)

    const [buses, setBuses] = useState([
        { id: 1, name: 'Karosa B741', line: '12', unlocked: false },
        { id: 2, name: 'Karosa B732', line: '5', unlocked: false },
        { id: 3, name: 'Irisbus Citelis', line: '18', unlocked: false },
        { id: 4, name: 'SOR NB12', line: '7', unlocked: false },
        { id: 5, name: 'Iveco Crossway', line: '23', unlocked: false },
    ])

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
        line.stops.some(stopId => {
            const stop = busStops.find(s => s.id === stopId)
            return stop && normalizeText(stop.name).includes(normalizeText(searchFrom))
        })
    )

    const filteredToLines = busLines.filter(line =>
        line.stops.some(stopId => {
            const stop = busStops.find(s => s.id === stopId)
            return stop && normalizeText(stop.name).includes(normalizeText(searchTo))
        })
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

    const unlockBus = (busId) => {
        setBuses(buses.map(bus =>
            bus.id === busId ? { ...bus, unlocked: true } : bus
        ))
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

    const unlockedCount = buses.filter(bus => bus.unlocked).length

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
                    {showCollectionMenu && (
                        <div className="collection-menu">
                            <div className="collection-menu-header">
                                <h4>Vaše kolekce</h4>
                                <button className="close-menu" onClick={() => setShowCollectionMenu(false)} aria-label="Zavřít">✕</button>
                            </div>
                            <div className="collection-menu-content">
                                {buses.length === 0 ? (
                                    <p className="empty-message">Zatím nemáte žádné autobusy ve své kolekci.</p>
                                ) : (
                                    <div className="bus-list">
                                        {buses.map(bus => (
                                            <div
                                                key={bus.id}
                                                className={`bus-item ${bus.unlocked ? 'unlocked' : 'locked'}`}
                                                onClick={() => !bus.unlocked && unlockBus(bus.id)}
                                            >
                                                <div className="bus-icon">
                                                    {bus.unlocked ? '🚌' : '🔒'}
                                                </div>
                                                <div className="bus-info">
                                                    <h5>{bus.name}</h5>
                                                    <span className="bus-line">Linka {bus.line}</span>
                                                </div>
                                                <div className="bus-status">
                                                    {bus.unlocked ? '✓' : '🔐'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <button
                        className={`banner ${showCollectionMenu ? 'open' : ''}`}
                        onClick={() => setShowCollectionMenu(!showCollectionMenu)}
                        aria-expanded={showCollectionMenu}
                    >
                        <span className="logo-box">
                            <img src="buslogo.png" alt="" />
                        </span>
                        <span className="info">
                            <span className="info-title">Kolekce</span>
                            <span className="info-sub">{unlockedCount} / {buses.length} nalezených autobusů</span>
                            <span className="collection-progress">
                                <span style={{ width: `${(unlockedCount / buses.length) * 100}%` }}></span>
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
