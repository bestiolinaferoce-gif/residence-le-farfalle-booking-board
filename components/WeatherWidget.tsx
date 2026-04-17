"use client";

import { useEffect, useState } from "react";

type WeatherData = { temperature: number; weathercode: number };

const WMO: Record<number, { icon: string; label: string }> = {
  0:  { icon: "☀️",  label: "Sereno" },
  1:  { icon: "🌤",  label: "Quasi sereno" },
  2:  { icon: "⛅",  label: "Parz. nuvoloso" },
  3:  { icon: "☁️",  label: "Coperto" },
  45: { icon: "🌫",  label: "Nebbia" },
  48: { icon: "🌫",  label: "Nebbia con brina" },
  51: { icon: "🌦",  label: "Pioggerella" },
  61: { icon: "🌧",  label: "Pioggia leggera" },
  63: { icon: "🌧",  label: "Pioggia" },
  65: { icon: "🌧",  label: "Pioggia intensa" },
  71: { icon: "❄️",  label: "Neve leggera" },
  80: { icon: "🌦",  label: "Acquazzone" },
  95: { icon: "⛈",  label: "Temporale" },
};

function getInfo(code: number) {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? { icon: "🌡", label: "" };
}

const CACHE_KEY = "weather-lfb-v1";
const CACHE_TTL = 15 * 60 * 1000; // 15 min

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached) as { data: WeatherData; ts: number };
        if (Date.now() - ts < CACHE_TTL) {
          setWeather(data);
          return;
        }
      }
    } catch { /* ignore */ }

    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=38.9558&longitude=17.0936&current_weather=true"
    )
      .then((r) => r.json())
      .then((d: { current_weather?: { temperature: number; weathercode: number } }) => {
        const cw = d.current_weather;
        if (!cw) return;
        const data: WeatherData = { temperature: cw.temperature, weathercode: cw.weathercode };
        setWeather(data);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
        } catch { /* ignore */ }
      })
      .catch(() => { /* silent fail */ });
  }, []);

  if (!weather) return null;

  const { icon, label } = getInfo(weather.weathercode);

  return (
    <div className="weather-widget" title={`Isola di Capo Rizzuto — ${label}`}>
      <span className="weather-icon">{icon}</span>
      <div className="weather-info">
        <span className="weather-temp">{weather.temperature}°C</span>
        <span className="weather-label">{label}</span>
      </div>
    </div>
  );
}
