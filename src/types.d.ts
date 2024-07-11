type Signal<T> = import("@preact/signals").Signal<T>;

interface OpenMeteoWeatherData {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    hourly_units: OpenMeteoHourlyUnits;
    hourly: OpenMeteoHourlyData;
}

interface OpenMeteoHourlyUnits {
    time: string;
    windspeed_1000hPa: string;
    windspeed_925hPa: string;
    windspeed_850hPa: string;
    windspeed_700hPa: string;
    windspeed_600hPa: string;
    winddirection_1000hPa: string;
    winddirection_925hPa: string;
    winddirection_850hPa: string;
    winddirection_700hPa: string;
    winddirection_600hPa: string;
}

type OpenMeteoPressureLevel = "1000" | "925" | "850" | "700" | "600";

interface OpenMeteoHourlyData {
    time: string[];
    windspeed_1000hPa: number[];
    windspeed_925hPa: number[];
    windspeed_850hPa: number[];
    windspeed_700hPa: number[];
    windspeed_600hPa: number[];
    winddirection_1000hPa: number[];
    winddirection_925hPa: number[];
    winddirection_850hPa: number[];
    winddirection_700hPa: number[];
    winddirection_600hPa: number[];
}

interface FormattedTableData {
    pressureLevels: {
        pressure: string;
        height: string;
    }[];
    todayData: Record<string, AverageWindSpeeds>;
    tomorrowData: Record<string, AverageWindSpeeds>;
}

type AverageWindSpeeds = {
    [key: string]: {
        speed: number;
        direction: number;
    };
};
