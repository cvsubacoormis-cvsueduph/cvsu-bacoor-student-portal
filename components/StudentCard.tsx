"use client";

import { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentCardSkeleton } from "./skeleton/StudentCardSkeleton";

export function StudentCard() {
  const [weatherData, setWeatherData] = useState({
    temperature: 0,
    condition: "sunny",
    description: "Loading weather data...",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const API_KEY = process.env.NEXT_PUBLIC_WEATHER_MAP_API_KEY;
        const response = await fetch(
          `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=Bacoor, Cavite&aqi=no`
        );
        const data = await response.json();

        const mapCondition = (code: number): string => {
          const rainyCodes = [
            1063, 1072, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240,
            1243, 1246,
          ];
          const cloudyCodes = [1003, 1006, 1009, 1030, 1135, 1147];
          const sunnyCodes = [1000];

          if (rainyCodes.includes(code)) return "rainy";
          if (cloudyCodes.includes(code)) return "cloudy";
          if (sunnyCodes.includes(code)) return "sunny";
          return "cloudy"; // default
        };

        setWeatherData({
          temperature: Math.round(data.current.temp_c),
          condition: mapCondition(data.current.condition.code),
          description: data.current.condition.text,
        });
      } catch (error) {
        console.log("Error fetching weather data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div>
        <StudentCardSkeleton />
      </div>
    );
  }

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case "sunny":
        return <Sun className="h-8 w-8 text-amber-500" />;
      case "cloudy":
        return <Cloud className="h-8 w-8 text-gray-500" />;
      case "rainy":
        return <CloudRain className="h-8 w-8 text-blue-500" />;
      default:
        return <Cloud className="h-8 w-8 text-gray-500" />;
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Weather & Time</CardTitle>
          {getWeatherIcon(weatherData.condition)}
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold">
                {weatherData.temperature}°C
              </div>
              <p className="text-xs text-muted-foreground">
                {weatherData.description}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-medium">
                {new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString("en-US", { weekday: "long" })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
