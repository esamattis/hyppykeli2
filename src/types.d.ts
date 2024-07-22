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
    source: "metar" | "fmi" | "roads" | "forecast" | "mock";
    gust?: number;
    speed?: number;
    direction?: number;
    temperature?: number;
    dewPoint?: number;
    rain?: number;
    lowCloudCover?: number;
    middleCloudCover?: number;
    time: Date;
}

/**
 * Interface representing a cloud layer.
 */
interface CloudLayer {
    base: number;
    amount: string;
    unit: string;
    href?: string;
}

/**
 * Interface representing METAR data.
 */
interface MetarData {
    clouds: CloudLayer[];
    temperature: number;
    dewpoint?: number;
    wind: {
        direction: number | "VRB";
        gust: number | undefined;
        speed: number;
        unit: string;
    };
    metar: string;
    time: Date;
    elevation?: number;
}

/**
 * Interface representing query parameters.
 */
interface QueryParams {
    debug?: string;
    mock?: string;
    rc?: string;
    fmisid?: string;
    roadsid?: string;
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
    high_winds_details?: string;
    flyk_metar?: string;
    save?: string;
}

/**
 * FMI stored query names
 */
type StoredQuery =
    | "fmi::avi::observations::iwxxm"
    | "fmi::observations::weather::timevaluepair"
    | "fmi::forecast::edited::weather::scandinavia::point::timevaluepair";

interface FlykMetar {
    type: string;
    features: FlykMetarFeature[];
}

interface FlykMetarFeature {
    type: string;
    geometry: FlykMetarGeometry;
    properties: FlykMetarProperties;
}

interface FlykMetarGeometry {
    type: string;
    coordinates: number[];
}

interface FlykMetarProperties {
    text: string;
    code: string;
    day: number;
    date: string;
    time: string;
    auto: boolean;
    wind: number;
    windDirection: number;
    visibility: string;
    temp: number;
    dewpoint: number;
    pressure: number;
    humidity: number;
    cavok: boolean;
    cloudiness: string;
    cloudbase: number;
    cloudbaseMeters: number;
    higherClouds: any[];
    ceiling: {
        code: string;
        feet_agl: number;
        meters_agl: number;
    };
    lat: number;
    lng: number;
    parsed: string;
    name: string;
    textOffset: number[];
    iconImage: string;
}

interface MetarJSResponse {
    type: "METAR";
    correction: boolean;
    station: string;
    time: string;
    auto: boolean;
    wind: {
        speed: number;
        gust: number | null;
        direction: number | "VRB";
        variation: number | null;
        unit: string;
    };
    cavok: boolean;
    visibility: number;
    visibilityVariation: number | null;
    visibilityVariationDirection: string | null;
    weather: {
        abbreviation: string;
        meaning: string;
    }[];
    clouds?: {
        abbreviation: string;
        meaning: string;
        altitude: number;
        cumulonimbus: boolean;
    }[];
    temperature: number;
    dewpoint: number;
    altimeterInHpa: number;
}

interface RoadSensorValue {
    id: number;
    stationId: number;
    name: string;
    shortName: string;
    measuredTime: string;
    value: number;
    unit: string;
}

interface RoadStationObservations {
    id: number;
    dataUpdatedTime: string;
    sensorValues: RoadSensorValue[];
}

interface RoadStationInfo {
    type: string;
    id: number;
    geometry: {
        type: string;
        coordinates: [number, number, number];
    };
    properties: {
        id: number;
        name: string;
        collectionStatus: string;
        state: string | null;
        dataUpdatedTime: string;
        collectionInterval: number;
        names: {
            fi: string;
            sv: string;
            en: string;
        };
        roadAddress: {
            roadNumber: number;
            roadSection: number;
            distanceFromRoadSectionStart: number;
            carriageway: string;
            side: string;
            contractArea: string;
            contractAreaCode: number;
        };
        liviId: string;
        country: string | null;
        startTime: string;
        repairMaintenanceTime: string | null;
        annualMaintenanceTime: string | null;
        purpose: string | null;
        municipality: string;
        municipalityCode: number;
        province: string;
        provinceCode: number;
        stationType: string;
        master: boolean;
        sensors: number[];
    };
}

declare module "metar" {}
declare function parseMETAR(metarString: string): MetarJSResponse;
