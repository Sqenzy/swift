import { useEffect, useRef, useState } from "react";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";

// npm install @maptiler/sdk

const MAPTILER_API_KEY = "a5seWWRpFzUpsQt5QU1r";
const NORMAL_STYLE = "outdoor-v4";
const DARK_STYLE = "01a0d829-14d7-7a52-a781-b2e7cca7de5c";
const ANIMATION_DURATION = 5000;
const BUS_API_URL = "http://localhost:8080/api/autobusy";

export default function BusMap() {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const busPositionsRef = useRef(new Map());
    const animationFrameRef = useRef(null);
    const pollIntervalRef = useRef(null);
    const [darkMode, setDarkMode] = useState(false);

    function addBusLayer(map) {
        map.loadImage("Symbols/busIcon.png").then((result) => {
            if (!map.hasImage("bus")) {
                map.addImage("bus", result.data);
            }

            if (!map.getSource("buses")) {
                map.addSource("buses", {
                    type: "geojson",
                    data: {
                        type: "FeatureCollection",
                        features: [],
                    },
                });
            }

            if (!map.getLayer("bus-layer")) {
                map.addLayer({
                    id: "bus-layer",
                    type: "symbol",
                    source: "buses",
                    layout: {
                        "icon-image": "bus",
                        "icon-size": 0.09,
                    },
                });
            }

            map.on("click", "bus-layer", (event) => {
                const properties = event.features[0].properties;

                new maptilersdk.Popup()
                    .setLngLat(event.lngLat)
                    .setHTML(
                        `<b>Line:</b> ${properties.lineId}<br>` +
                        `<b>Destination:</b> ${properties.destinationName}<br>` +
                        `<b>Vehicle ID:</b> ${properties.vid}`
                    )
                    .addTo(map);
            });
        });
    }

    function updateBuses() {
        fetch(BUS_API_URL)
            .then((response) => response.json())
            .then((data) => {
                const now = performance.now();
                const busPositions = busPositionsRef.current;

                data.forEach((bus) => {
                    const vid = bus.vid;
                    const newPosition = [Number(bus.GpsLon), Number(bus.GpsLat)];
                    const old = busPositions.get(vid);

                    if (old) {
                        const currentProgress = Math.min(
                            (now - old.startTime) / ANIMATION_DURATION,
                            1
                        );

                        const currentPosition = [
                            old.start[0] + (old.target[0] - old.start[0]) * currentProgress,
                            old.start[1] + (old.target[1] - old.start[1]) * currentProgress,
                        ];

                        busPositions.set(vid, {
                            start: currentPosition,
                            target: newPosition,
                            startTime: now,
                            lineId: bus.lineId,
                            destinationName: bus.destinationName,
                        });
                    } else {
                        busPositions.set(vid, {
                            start: newPosition,
                            target: newPosition,
                            startTime: now,
                            lineId: bus.lineId,
                            destinationName: bus.destinationName,
                        });
                    }
                });
            })
            .catch((err) => console.error("Failed to fetch bus data:", err));
    }

    function animateBuses(timestamp, map) {
        const features = [];
        const busPositions = busPositionsRef.current;

        busPositions.forEach((position, vid) => {
            const progress = Math.min(
                (timestamp - position.startTime) / ANIMATION_DURATION,
                1
            );

            const longitude =
                position.start[0] + (position.target[0] - position.start[0]) * progress;
            const latitude =
                position.start[1] + (position.target[1] - position.start[1]) * progress;

            features.push({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                },
                properties: {
                    vid,
                    destinationName: position.destinationName,
                    lineId: position.lineId,
                },
            });
        });

        const geojson = {
            type: "FeatureCollection",
            features,
        };

        const source = map.getSource("buses");
        if (source) {
            source.setData(geojson);
        }

        animationFrameRef.current = requestAnimationFrame((t) =>
            animateBuses(t, map)
        );
    }

    // Initialize map once
    useEffect(() => {
        maptilersdk.config.apiKey = MAPTILER_API_KEY;

        const map = new maptilersdk.Map({
            container: mapContainerRef.current,
            center: [15.78, 50.03],
            zoom: 14,
        });

        mapRef.current = map;

        map.addControl(new maptilersdk.GeolocateControl(), "top-right");

        map.on("style.load", () => {
            addBusLayer(map);
        });

        updateBuses();
        pollIntervalRef.current = setInterval(updateBuses, 5000);
        animationFrameRef.current = requestAnimationFrame((t) =>
            animateBuses(t, map)
        );

        return () => {
            clearInterval(pollIntervalRef.current);
            cancelAnimationFrame(animationFrameRef.current);
            map.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Toggle style when darkMode changes
    useEffect(() => {
        if (!mapRef.current) return;
        mapRef.current.setStyle(darkMode ? DARK_STYLE : NORMAL_STYLE);
    }, [darkMode]);

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh" }}>
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
            <button
                onClick={() => setDarkMode((prev) => !prev)}
                style={{ position: "absolute", top: 10, left: 20, zIndex: 1 }}
            >
                Change Light Mode
            </button>
        </div>
    );
}