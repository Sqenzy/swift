import {useState, useEffect} from 'react'
import './Home.css'
import BusMap from "./Map.jsx"
import { busLines } from './data/busLines.js'
import { busStops } from './data/busStops.js'

export default function Home() {

    const [valueFrom, setValueFrom] = useState('')
    const [valueTo, setValueTo] = useState('')
    const [middleFilled, setMiddleFilled] = useState(false)
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

    useEffect(() => {
        if (valueFrom && valueTo) {
            const timer = setTimeout(() => setMiddleFilled(true), 500)
            return () => clearTimeout(timer)
        } else {
            setMiddleFilled(false)
        }
    }, [valueFrom, valueTo])

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

    return (
        <>
            <header className="header">
                <div className="title">
                    <p className="name">Trasa</p>
                </div>
                <div className="selection">
                    <button className="del" onClick={() => setValueFrom('')}><img src="close.png"></img></button>
                    <div className="select-wrapper">
                        <div className="select-current">{valueFrom || "Vyberte zastavku"}</div>
                        <div className="select-options">
                            <button onClick={() => setValueFrom('Hlavni Nadrazi')}>Hlavni Nadrazi</button>
                            <button onClick={() => setValueFrom('Polabiny')}>Polabiny</button>
                            <button onClick={() => setValueFrom('Pardubicky')}>Pardubicky</button>
                        </div>
                    </div>
                    <div className="separator">
                        <div className={valueFrom ? "dot filled" : "dot"} id="dot1"></div>
                        <div className={middleFilled ? "dot filled pulse" : "dot"} id="dot2"></div>
                        <div className={valueTo ? "dot filled" : "dot"} id="dot3"></div>
                    </div>
                    <div className="select-wrapper">
                        <div className="select-current">{valueTo || "Vyberte zastavku"}</div>
                        <div className="select-options">
                            <button onClick={() => setValueTo('Hlavni Nadrazi')}>Hlavni Nadrazi</button>
                            <button onClick={() => setValueTo('Polabiny')}>Polabiny</button>
                            <button onClick={() => setValueTo('Pardubicky')}>Pardubicky</button>
                        </div>
                    </div>
                    <button className="del" id="second" onClick={() => setValueTo('')}><img src="close.png"></img></button>
                </div>
            </header>
            <section className="sidebar">
                <div className="sidebar-header">
                    <p className="name">Linky</p>
                </div>
                <div className="search-section">
                    <div className="search-container">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Odkud"
                            value={searchFrom}
                            onChange={(e) => {
                                setSearchFrom(e.target.value)
                                setShowFromResults(true)
                            }}
                            onFocus={() => setShowFromResults(true)}
                        />
                        {showFromResults && searchFrom && (filteredFromStops.length > 0 || filteredFromLines.length > 0) && (
                            <div className="search-results">
                                {filteredFromStops.length > 0 && (
                                    <div className="search-result-section">
                                        <div className="search-result-section-title">Zastávky</div>
                                        {filteredFromStops.map(stop => (
                                            <div
                                                key={stop.id}
                                                className="search-result-item"
                                                onClick={() => {
                                                    setSearchFrom(stop.name)
                                                    setShowFromResults(false)
                                                }}
                                            >
                                                {stop.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {filteredFromLines.length > 0 && (
                                    <div className="search-result-section">
                                        <div className="search-result-section-title">Linky</div>
                                        {filteredFromLines.map(line => (
                                            <div
                                                key={line.id}
                                                className="search-result-item line-result"
                                                onClick={() => {
                                                    setSearchFrom(line.name)
                                                    setShowFromResults(false)
                                                }}
                                                style={{ '--line-color': line.color }}
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
                    <div className="search-container">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Kam"
                            value={searchTo}
                            onChange={(e) => {
                                setSearchTo(e.target.value)
                                setShowToResults(true)
                            }}
                            onFocus={() => setShowToResults(true)}
                        />
                        {showToResults && searchTo && (filteredToStops.length > 0 || filteredToLines.length > 0) && (
                            <div className="search-results">
                                {filteredToStops.length > 0 && (
                                    <div className="search-result-section">
                                        <div className="search-result-section-title">Zastávky</div>
                                        {filteredToStops.map(stop => (
                                            <div
                                                key={stop.id}
                                                className="search-result-item"
                                                onClick={() => {
                                                    setSearchTo(stop.name)
                                                    setShowToResults(false)
                                                }}
                                            >
                                                {stop.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {filteredToLines.length > 0 && (
                                    <div className="search-result-section">
                                        <div className="search-result-section-title">Linky</div>
                                        {filteredToLines.map(line => (
                                            <div
                                                key={line.id}
                                                className="search-result-item line-result"
                                                onClick={() => {
                                                    setSearchTo(line.name)
                                                    setShowToResults(false)
                                                }}
                                                style={{ '--line-color': line.color }}
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
                </div>
                <div className="content">
                    <div className="lines">
                        {sortedBusLines.map(line => (
                            <button
                                key={line.id}
                                className={`line ${selectedLine === line.id ? 'active' : ''}`}
                                onClick={() => setSelectedLine(line.id)}
                                style={{ '--line-color': line.color }}
                            >
                                <div className="line-info">
                                    <div className="line-logo-box">
                                        <img src="buslogo.png" alt="bus" className="line-logo" />
                                        <span className="line-number">{line.number}</span>
                                    </div>
                                </div>
                                <span className="line-name">{line.name}</span>
                                <button
                                    className={`favorite-btn ${favorites.includes(line.id) ? 'favorited' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleFavorite(line.id)
                                    }}
                                >
                                    {favorites.includes(line.id) ? '★' : '☆'}
                                </button>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="colection">
                    <div className="banner" onClick={() => setShowCollectionMenu(!showCollectionMenu)}>
                        <div className="logo-div">
                            <div className="logo-box">
                                <img src="buslogo.png" alt="buslogo" />
                            </div>
                        </div>
                        <div className="info">
                            <h3>Kolekce</h3>
                            <h6>Sbírka nalezených autobusů</h6>
                        </div>
                    </div>
                    {showCollectionMenu && (
                        <div className="collection-menu">
                            <div className="collection-menu-header">
                                <h4>Vaše kolekce</h4>
                                <button className="close-menu" onClick={() => setShowCollectionMenu(false)}>✕</button>
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
                </div>
                <div className="footer">
                    <button className="changemode"
                            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
                            aria-label="Toggle dark/light mode">
                        <img src="mode.png"/>
                    </button>
                </div>
            </section>

            <section className="map">
                <BusMap/>
            </section>
        </>
        )
}