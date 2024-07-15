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

type OpenMeteoDayData = Record<
    string,
    {
        data: AverageWindSpeeds;
        isCurrentBlock: boolean;
    }
>;

/**
 * Interface representing weather data.
 */
interface WeatherData {
    gust: number;
    speed: number;
    direction: number;
    temperature: number;
    rain?: number;
    lowCloudCover?: number | undefined;
    middleCloudCover?: number | undefined;
    time: Date;
}

/**
 * Interface representing a cloud layer.
 */
interface CloudLayer {
    base: number;
    amount: string;
    unit: string;
    href: string;
}

/**
 * Interface representing METAR data.
 */
interface MetarData {
    clouds: CloudLayer[];
    metar: string;
    time: Date;
    elevation: number;
}

/**
 * Interface representing query parameters.
 */
interface QueryParams {
    fmisid?: string;
    icaocode?: string;
    lat?: string;
    lon?: string;
    name?: string;
    observation_range?: string;
    forecast_day?: string;
    forecast_range?: string;
    direction?: string;
    gust?: string;
    css?: string;
}

/**
 * FMI stored query names
 */
type StoredQuery =
    | "fmi::avi::observations::iwxxm"
    | "fmi::observations::weather::timevaluepair"
    | "fmi::forecast::edited::weather::scandinavia::point::timevaluepair";
