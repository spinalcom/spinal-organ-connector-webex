export interface IWorkplaceCapabilitiesApiResponse {
    capabilities:  IWorkplaceCapabilitiesInfo
}

export interface IWorkplaceCapabilitiesInfo {
    occupancyDetection: {
        supported: boolean;
        configured: boolean;
    };
    presenceDetection: {
        supported: boolean;
        configured: boolean;
    };
    temperature: {
        supported: boolean;
        configured: boolean;
    };
    relativeHumidity: {
        supported: boolean;
        configured: boolean;
    };
    ambientNoise: {
        supported: boolean;
        configured: boolean;
    };
    airQuality: {
        supported: boolean;
        configured: boolean;
    };
    soundLevel: {
        supported: boolean;
        configured: boolean;
    };
    hotDesking: {
        supported: boolean;
        configured: boolean;
    };


}